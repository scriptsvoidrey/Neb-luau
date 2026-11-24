import { useEffect, useRef, useState } from 'react'
import { Eye, Monitor, Play, RotateCcw, Tablet, Smartphone } from 'lucide-react'
import CodeEditor from '../editors/CodeEditor'
import { Button, Empty, UploadButton } from '../components/ui'
import { useStored } from '../hooks/useStored'
import { labels, readText } from '../lib/files'
import { samples, type Language, type Tool } from './catalog'

type Field = 'html' | 'css' | 'javascript' | 'markdown' | 'xml'
interface Contents { html: string; css: string; javascript: string; markdown: string; xml: string; selector: string }
const initial: Contents = { html: '', css: '', javascript: '', markdown: '', xml: '', selector: 'main' }
const defaultStyles = 'body{font-family:system-ui,sans-serif;margin:0;padding:20px;color:#1f2030;background:#fff}img,svg{max-width:100%}pre{overflow:auto}a{color:#5336a4}'

function safeDocument(source: string) {
  const template = document.createElement('template')
  template.innerHTML = source
  for (const item of template.content.querySelectorAll('script, iframe, frame, frameset, object, embed, base, link, meta[http-equiv], audio, video, source')) item.remove()
  for (const item of template.content.querySelectorAll('*')) {
    for (const attr of Array.from(item.attributes)) {
      if (attr.name.startsWith('on') || ['srcset', 'ping', 'action', 'formaction', 'background', 'target'].includes(attr.name) || (['src', 'href', 'xlink:href', 'poster'].includes(attr.name) && !/^(?:#|data:image\/(?:png|jpeg|gif|webp|svg\+xml);)/i.test(attr.value))) item.removeAttribute(attr.name)
    }
  }
  return template.innerHTML
}

function serialize(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

async function createPreview(contents: Contents, toolId: string, runId: string, allowUserScripts: boolean) {
  const inspect = toolId === 'css-inspect'
  const svg = toolId === 'svg-view'
  const markdown = toolId === 'markdown'
  const source = markdown ? await (await import('marked')).marked.parse(contents.markdown) : contents.html
  let body = safeDocument(source)
  if (svg) {
    if (contents.xml.trim()) {
      const document = new DOMParser().parseFromString(contents.xml, 'image/svg+xml')
      if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg' || document.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('El documento SVG no es válido. Comprueba que tenga una raíz <svg> y su espacio de nombres.')
    }
    body = contents.xml.trim() ? `<img alt="Vista previa SVG" src="data:image/svg+xml,${encodeURIComponent(contents.xml).replace(/'/g, '%27')}">` : ''
  }
  const scripts = inspect || allowUserScripts
  const nonce = runId.replaceAll('-', '')
  const policy = `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src ${scripts ? `'nonce-${nonce}'${allowUserScripts ? " 'unsafe-eval'" : ''}` : "'none'"}; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'`
  const css = markdown || svg || toolId === 'html-view' ? '' : contents.css.replace(/<\/style/gi, '<\\/style')
  const bridge = scripts ? `<script nonce="${nonce}">
    const send = (kind, detail) => parent.postMessage({nebRun:${serialize(runId)},kind,detail}, '*');
    ${inspect ? `window.addEventListener('DOMContentLoaded', () => {
      try {
        const item = document.querySelector(${serialize(contents.selector)});
        if (!item) { send('error', 'Ningún elemento coincide con el selector.'); return; }
        const css = getComputedStyle(item);
        const fields = ['display','position','width','height','margin','padding','color','background-color','font-family','font-size','line-height','border','border-radius','box-shadow','gap','justify-content','align-items','grid-template-columns'];
        send('styles', fields.map(field => field + ': ' + css.getPropertyValue(field)).join('\\n'));
      } catch (error) { send('error', error.message); }
    });` : `let emissions = 0;
      const print = (...values) => { if (emissions++ >= 100) return; send('log', values.map(value => { try { return typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value)); } catch { return String(value); } }).join(' ').slice(0, 2000)); };
      for (const method of ['log','info','warn','error']) console[method] = print;
      window.addEventListener('error', event => print(event.message));
      window.addEventListener('unhandledrejection', event => print(String(event.reason)));
      window.addEventListener('DOMContentLoaded', () => { try { (0,eval)(${serialize(contents.javascript)}); } catch (error) { print(String(error)); } });`}
  </script>` : ''
  return `<!DOCTYPE html><html lang="es"><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${defaultStyles}\n${css}</style>${bridge}</head><body>${body}</body></html>`
}

export default function PreviewTool({ tool }: { tool: Tool }) {
  const { value, update, status } = useStored(`tool:${tool.id}`, initial)
  const fields: Field[] = tool.id === 'svg-view' ? ['xml'] : tool.id === 'markdown' ? ['markdown'] : tool.id === 'html-view' ? ['html'] : tool.id === 'js-playground' ? ['javascript', 'html', 'css'] : tool.id === 'css-playground' || tool.id === 'css-inspect' ? ['css', 'html'] : tool.id === 'html-playground' ? ['html', 'css', 'javascript'] : ['html', 'css']
  const [field, setField] = useState<Field>(fields[0])
  const live = ['live-preview', 'markdown', 'svg-view', 'html-view', 'responsive', 'css-playground'].includes(tool.id)
  const [preview, setPreview] = useState<{ html: string; id: string }>()
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [computed, setComputed] = useState('')
  const [width, setWidth] = useState('100%')
  const frame = useRef<HTMLIFrameElement>(null)
  const latest = useRef('')
  const runnable = fields.includes('javascript')
  const contents = useRef(value)
  contents.current = value

  const render = async (allowScripts = false) => {
    const id = crypto.randomUUID()
    latest.current = id
    setError(''); setLogs([]); setComputed('')
    try {
      if (Object.values(contents.current).reduce((total, part) => total + part.length, 0) > 500_000) throw new Error('La vista previa admite hasta 500 mil caracteres de código.')
      const html = await createPreview(contents.current, tool.id, id, allowScripts)
      if (id === latest.current) setPreview({ html, id })
    } catch (failure) {
      if (id === latest.current) { setError(failure instanceof Error ? failure.message : String(failure)); setPreview(undefined) }
    }
  }
  const renderRef = useRef(render)
  renderRef.current = render
  useEffect(() => {
    if (!live || status === 'loading') return
    const timer = window.setTimeout(() => void renderRef.current(), 350)
    return () => window.clearTimeout(timer)
  }, [value, status === 'loading', live])
  useEffect(() => {
    const receive = (event: MessageEvent<{ nebRun?: string; kind?: string; detail?: string }>) => {
      const payload = event.data
      if (!payload || event.source !== frame.current?.contentWindow || payload.nebRun !== latest.current || typeof payload.detail !== 'string') return
      if (payload.kind === 'log') setLogs(previous => previous.length < 100 ? [...previous, payload.detail!.slice(0, 2000)] : previous)
      if (payload.kind === 'styles' && tool.id === 'css-inspect') setComputed(payload.detail.slice(0, 5000))
      if (payload.kind === 'error' && tool.id === 'css-inspect') setError(payload.detail.slice(0, 500))
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [tool.id])
  const setContent = (language: Field, content: string) => update(previous => ({ ...previous, [language]: content }))

  return <>
    <div className="operation-actions toolbar">
      <UploadButton onFiles={files => { if (files[0]) void readText(files[0], 500_000).then(text => setContent(field, text), failure => setError(String(failure))) }} />
      <Button onClick={() => update({ ...initial, html: samples.html ?? '', css: samples.css ?? '', javascript: 'document.querySelector("main h1").textContent = "JavaScript en ejecución";\nconsole.log("Vista previa lista");', markdown: samples.markdown ?? '', xml: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150">\n  <rect width="240" height="150" rx="20" fill="#1e1634"/>\n  <circle cx="120" cy="75" r="34" fill="#ae99ff"/>\n</svg>' })}>Ejemplo</Button>
      <Button onClick={() => { update(initial); latest.current = ''; setPreview(undefined); setLogs([]); setComputed(''); setError('') }}><RotateCcw />Limpiar</Button>
      {tool.id === 'css-inspect' && <label className="inline-label">Selector<input value={value.selector} onChange={event => update(previous => ({ ...previous, selector: event.target.value }))} /></label>}
      <Button kind="primary" onClick={() => void render(runnable)}>{runnable ? <Play /> : <Eye />}{runnable ? 'Ejecutar vista previa' : tool.id === 'css-inspect' ? 'Inspeccionar' : 'Actualizar vista'}</Button>
      {tool.id === 'responsive' && <div className="toolbar viewport-controls" aria-label="Ancho de vista previa">{[{ title: 'Móvil 375 px', size: '375px', Icon: Smartphone }, { title: 'Tableta 768 px', size: '768px', Icon: Tablet }, { title: 'Escritorio', size: '100%', Icon: Monitor }].map(({ title, size, Icon }) => <Button key={size} title={title} aria-label={title} aria-pressed={width === size} className="icon-button" onClick={() => setWidth(size)}><Icon /></Button>)}</div>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {status === 'error' && <p className="error" role="status">El navegador no pudo guardar el borrador local.</p>}
    {runnable && <p className="hint">Ejecuta solo código de confianza. Añade JavaScript en su pestaña; se ejecuta al pulsar el botón.</p>}
    <div className={tool.id === 'responsive' ? 'tool-panels single' : 'tool-panels'}>
      <section className="panel"><div className="tab-strip" aria-label="Lenguaje de vista previa">{fields.map(item => <button type="button" key={item} className={`tab-name ${field === item ? 'active' : ''}`} aria-pressed={field === item} onClick={() => setField(item)}>{item === 'xml' ? 'SVG' : labels[item as Language]}</button>)}</div><div className="tool-editor"><CodeEditor key={field} label={`Código ${labels[field]}`} language={field} value={value[field]} onChange={text => setContent(field, text)} /></div></section>
      <section className="panel"><div className="panel-bar"><Eye />Vista previa{tool.id === 'responsive' && <span>{width}</span>}</div>
        {preview ? <div className="preview-scroll"><iframe key={preview.id} ref={frame} style={{ width }} title="Vista previa del código" sandbox={runnable || tool.id === 'css-inspect' ? 'allow-scripts' : ''} referrerPolicy="no-referrer" srcDoc={preview.html} /></div> : <Empty title="Vista previa vacía" detail="Añade código o carga el ejemplo para empezar." icon={<Eye />} />}
      </section>
    </div>
    {runnable && preview && <section className="panel console-panel"><div className="panel-bar">Consola</div><pre>{logs.length ? logs.join('\n') : 'No se han registrado mensajes.'}</pre></section>}
    {tool.id === 'css-inspect' && computed && <section className="panel console-panel"><div className="panel-bar">Estilos calculados</div><pre>{computed}</pre></section>}
  </>
}
