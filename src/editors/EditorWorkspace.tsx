import { useEffect, useRef, useState, type RefObject } from 'react'
import { Braces, CircleAlert, Code2, FileCode2, PanelTop, Plus, Redo2, Search, Undo2, X } from 'lucide-react'
import { undo, redo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import type { EditorView } from '@codemirror/view'
import CodeEditor, { createEditorSession, type EditorSession } from './CodeEditor'
import { Button, CopyButton, Empty, messageOf, NameDialog, PageHeading, SaveButton, UploadButton } from '../components/ui'
import { extensionFor, labels, languages, readText } from '../lib/files'
import { createRunner } from '../lib/worker'
import { createDocument, restoreLanguage, type DocumentFile } from '../lib/workspace'
import type { useStored } from '../hooks/useStored'
import type { Language } from '../tools/catalog'

export interface Tabs { files: DocumentFile[]; active: string }

export default function EditorWorkspace({ store, states }: { store: ReturnType<typeof useStored<Tabs>>; states: RefObject<Map<string, EditorSession>> }) {
  const { value, update, status } = store
  const active = value.files.find(file => file.id === value.active) ?? value.files[0]
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [nameDialog, setNameDialog] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const runner = useRef(createRunner())
  const view = useRef<EditorView | null>(null)
  const current = useRef(active)
  current.current = active
  useEffect(() => () => runner.current.close(), [])

  const patch = (id: string, attributes: Partial<DocumentFile>) => update(previous => ({ ...previous, files: previous.files.map(file => file.id === id ? { ...file, ...attributes } : file) }))
  const add = (files: DocumentFile[]) => {
    if (files.length) update(previous => ({ files: [...previous.files, ...files], active: files[0].id }))
  }
  const close = (id: string) => {
    states.current.delete(id)
    update(previous => {
      const index = previous.files.findIndex(file => file.id === id)
      const files = previous.files.filter(file => file.id !== id)
      return { files, active: previous.active === id ? files[Math.min(index, files.length - 1)]?.id ?? '' : previous.active }
    })
  }
  const format = async () => {
    if (!active) return
    setBusy(true); setError('')
    try {
      const result = await runner.current.run({ id: 'format', text: active.content, language: restoreLanguage(active) })
      if (current.current?.id === active.id && current.current.content === active.content && view.current) {
        view.current.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: result.text } })
      } else if (current.current?.id !== active.id) {
        update(previous => ({ ...previous, files: previous.files.map(file => file.id === active.id && file.content === active.content ? { ...file, content: result.text } : file) }))
      } else setError('El documento cambió mientras se formateaba. Vuelve a intentarlo.')
    } catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }
  const importFiles = async (files: File[]) => {
    setError('')
    const entries = await Promise.all(files.slice(0, 25).map(async file => {
      try { return createDocument(file.name, await readText(file)) }
      catch (failure) { setError(`${file.name}: ${messageOf(failure)}`); return null }
    }))
    add(entries.filter(entry => entry !== null))
  }
  let session = active && states.current.get(active.id)
  if (active && !session) { session = createEditorSession(); states.current.set(active.id, session) }

  return <>
    <PageHeading eyebrow="ESPACIO DE TRABAJO" title="Editor de código" description="Edita varios archivos a la vez. Tus pestañas se guardan en este navegador." actions={<><UploadButton multiple onFiles={files => void importFiles(files)} /><Button kind="primary" onClick={() => add([createDocument(`script-${value.files.length + 1}.luau`)])}><Plus />Nuevo archivo</Button></>} />
    <div className="editor-workspace panel">
      <div className="tab-strip" aria-label="Archivos abiertos">{value.files.map(file => <div className={`tab ${active?.id === file.id ? 'active' : ''}`} key={file.id}>
        <button className="tab-name" aria-current={active?.id === file.id ? 'true' : undefined} onClick={() => update(previous => ({ ...previous, active: file.id }))}><FileCode2 size={15} />{file.name}</button>
        <button className="tab-close" aria-label={`Cerrar ${file.name}`} onClick={() => close(file.id)}><X size={14} /></button>
      </div>)}</div>
      {active && session ? <>
        <div className="editor-toolbar toolbar">
          <select aria-label="Lenguaje" value={active.language} onChange={event => patch(active.id, { language: event.target.value as Language })}>{languages.map(language => <option key={language} value={language}>{labels[language]}</option>)}</select>
          <Button onClick={() => setNameDialog(true)}><PanelTop />Renombrar</Button>
          <Button className="icon-button" title="Deshacer" aria-label="Deshacer" onClick={() => view.current && undo(view.current)}><Undo2 /></Button>
          <Button className="icon-button" title="Rehacer" aria-label="Rehacer" onClick={() => view.current && redo(view.current)}><Redo2 /></Button>
          <Button className="icon-button" title="Buscar y reemplazar" aria-label="Buscar y reemplazar" onClick={() => view.current && openSearchPanel(view.current)}><Search /></Button>
          <Button onClick={() => void format()} disabled={busy}><Braces />{busy ? 'Formateando…' : 'Formatear'}</Button>
          <CopyButton value={active.content} onError={setError} />
          <SaveButton value={active.content} name={active.name.includes('.') ? active.name : `${active.name}.${extensionFor(active.language)}`} />
        </div>
        <div className="workspace-editor">
          <CodeEditor key={active.id} session={session} diagnostics value={active.content} language={active.language} label={`Código de ${active.name}`} onView={editor => { view.current = editor }} onSelection={setCursor} onChange={content => patch(active.id, { content })} />
        </div>
        <div className="editor-status"><span><Code2 size={13} />{labels[active.language]} · UTF-8</span><span>Línea {cursor.line}, col. {cursor.column}</span><span className={status === 'error' ? 'danger-text' : ''}>{status === 'error' ? 'No guardado' : status === 'saving' ? 'Guardando…' : status === 'loading' ? 'Cargando…' : 'Guardado local'}</span></div>
      </> : <Empty title="No hay archivos abiertos" detail="Crea una pestaña o importa un archivo de texto." />}
    </div>
    {(error || status === 'error') && <p className="error" role="alert"><CircleAlert />{error || 'El navegador no permite guardar los cambios. Descarga tus archivos antes de cerrar.'}</p>}
    {nameDialog && active && <NameDialog title="Renombrar archivo" initial={active.name} onClose={() => setNameDialog(false)} onSubmit={name => patch(active.id, { name })} />}
  </>
}
