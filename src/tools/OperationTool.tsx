import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRight, Braces, FileCode2, Play, RotateCcw, Sparkles, Square } from 'lucide-react'
import CodeEditor from '../editors/CodeEditor'
import { useStored } from '../hooks/useStored'
import { extensionFor, labels, maybeLanguage, readText } from '../lib/files'
import { createRunner } from '../lib/worker'
import { Button, CopyButton, Empty, messageOf, SaveButton, UploadButton } from '../components/ui'
import { samples, type Language, type Tool } from './catalog'
import type { Result } from './operations'

interface Draft { text: string; second: string; option: string; pattern: string; flags: string; count: number }

export default function OperationTool({ tool, openEditor }: { tool: Tool; openEditor: (content: string, language: Language, name?: string) => void }) {
  const defaults: Draft = { text: '', second: '', option: tool.select?.[0] ?? '', pattern: '', flags: 'g', count: 1 }
  const { value: draft, update, status } = useStored(`tool:${tool.id}`, defaults, tool.id !== 'jwt-decode')
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const runner = useRef(createRunner())
  const isLuaViewer = tool.kind === 'editor'
  const language = maybeLanguage(draft.option) ?? tool.language ?? 'text'
  const semanticResults = ['lua-check', 'lua-analyze', 'lua-compress', 'json-validate', 'jwt-decode', 'regex', 'words', 'characters', 'csv-view']
  const outputLanguage = tool.output ?? (semanticResults.includes(tool.id) ? 'text' : language)
  const resultName = tool.id === 'json-csv' || tool.id === 'csv-view' ? 'resultado.csv' : tool.id === 'svg-optimize' ? 'resultado.svg' : `resultado.${extensionFor(outputLanguage)}`
  const example = tool.example ?? (tool.id === 'jwt-decode' ? `${btoa('{"alg":"none","typ":"JWT"}')}.${btoa('{"sub":"ejemplo"}')}.` : samples[language]) ?? 'NEB LUAU\nHerramientas de desarrollo en tu navegador.'
  const patch = (change: Partial<Draft>) => update(previous => ({ ...previous, ...change }))
  useEffect(() => () => runner.current.close(), [])

  const process = async () => {
    setError(''); setRunning(true)
    try { setResult(isLuaViewer ? { text: draft.text } : await runner.current.run({ id: tool.id, ...draft, language })) }
    catch (failure) { if (!(failure instanceof DOMException && failure.name === 'AbortError')) { setError(messageOf(failure)); setResult(undefined) } }
    finally { setRunning(false) }
  }

  const loadFile = (files: File[]) => {
    if (!files[0]) return
    setError(''); void readText(files[0]).then(text => patch({ text }), failure => setError(messageOf(failure)))
  }

  return <>
    <div className="operation-actions toolbar">
      {!tool.inputless && <><UploadButton onFiles={loadFile} /><Button onClick={() => patch({ text: example, ...(tool.comparison ? { second: example.replace('NEB LUAU', 'mi proyecto') } : {}), ...(tool.id === 'regex' ? { pattern: 'Lua\\w*', flags: 'gi' } : {}) })}><Sparkles />Ejemplo</Button></>}
      <Button onClick={() => { update(defaults); setResult(undefined); setError(''); runner.current.close() }}><RotateCcw />Limpiar</Button>
      {tool.select && <label className="inline-label">{tool.id === 'hash' ? 'Algoritmo' : tool.id === 'sql-format' ? 'Dialecto' : 'Lenguaje'} <select value={draft.option} onChange={event => patch({ option: event.target.value })}>{tool.select.map(item => <option key={item} value={item}>{labels[item as Language] ?? item}</option>)}</select></label>}
      {tool.inputless && <label className="inline-label">Cantidad<input type="number" min={1} max={tool.id === 'uuid' ? 100 : 50} value={draft.count} onChange={event => patch({ count: Number(event.target.value) || 1 })} /></label>}
      <Button kind="primary" disabled={running} onClick={() => void process()}><Play />{running ? 'Procesando…' : isLuaViewer ? 'Visualizar' : tool.inputless ? 'Generar' : tool.comparison ? 'Comparar' : 'Procesar'}</Button>
      {running && <Button onClick={() => runner.current.close()}><Square />Cancelar</Button>}
    </div>
    {tool.id === 'regex' && <div className="toolbar regex-fields"><label>Patrón<input value={draft.pattern} onChange={event => patch({ pattern: event.target.value })} placeholder="Lua\w*" /></label><label>Flags<input value={draft.flags} onChange={event => patch({ flags: event.target.value })} placeholder="gi" /></label></div>}
    {tool.id === 'jwt-decode' && <p className="hint">El JWT no se guarda ni se envía. Decodificar no equivale a verificar la firma.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {status === 'error' && <p className="error" role="status">El navegador no pudo guardar el borrador local.</p>}
    <div className={`tool-panels ${tool.inputless ? 'single' : ''}`}>
      {!tool.inputless && <section className="panel"><div className="panel-bar"><FileCode2 />{tool.comparison ? 'Original' : 'Entrada'}<span>{labels[language]}</span></div><div className="tool-editor"><CodeEditor value={draft.text} onChange={text => patch({ text })} language={language} label={tool.comparison ? 'Original' : 'Entrada'} /></div></section>}
      {tool.comparison && <section className="panel"><div className="panel-bar"><FileCode2 />Modificado<span>{labels[language]}</span></div><div className="tool-editor"><CodeEditor value={draft.second} onChange={second => patch({ second })} language={language} label="Modificado" /></div></section>}
      <section className={`panel output-panel ${tool.comparison ? 'full-width' : ''}`}>
        <div className="panel-bar"><Braces />Resultado{result && <span>{result.changes ? 'Comparación' : result.table ? 'Tabla' : result.file ? 'Archivo' : labels[outputLanguage]}</span>}</div>
        {!result ? <Empty title={running ? 'Procesando…' : 'Sin resultado todavía'} detail={running ? 'La herramienta trabaja en segundo plano.' : 'El resultado aparece aquí tras procesar la entrada.'} icon={<ArrowDownToLine />} /> : result.table ? <div className="table-scroll"><table><thead><tr>{result.table[0]?.slice(0, 60).map((cell, index) => <th key={index}>{cell}</th>)}</tr></thead><tbody>{result.table.slice(1).map((row, index) => <tr key={index}>{row.slice(0, 60).map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table><p className="hint">Vista previa: hasta 500 filas y 60 columnas. Descarga el CSV para conservar todos los datos.</p></div> : result.changes && result.text.length < 80_000 ? <pre className="diff-output">{result.changes.map((change, index) => <span className={change.kind} key={index}>{change.text.replace(/\n$/, '').split('\n').map(line => `${change.kind === 'added' ? '+' : change.kind === 'removed' ? '-' : ' '} ${line}`).join('\n') + '\n'}</span>)}</pre> : <div className="tool-editor"><CodeEditor value={result.text} language={outputLanguage} label="Resultado" readOnly /></div>}
        {result && <div className="output-actions toolbar">{result.file ? <SaveButton value={result.file.data} name={result.file.name} type={result.file.type} /> : <><CopyButton value={result.text} onError={setError} /><SaveButton value={result.text} name={resultName} />{!result.changes && !result.table && !semanticResults.includes(tool.id) && <Button onClick={() => openEditor(result.text, outputLanguage, resultName)}>Abrir en editor<ArrowRight /></Button>}</>}</div>}
      </section>
    </div>
  </>
}
