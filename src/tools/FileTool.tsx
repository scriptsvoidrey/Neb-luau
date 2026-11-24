import { useEffect, useRef, useState } from 'react'
import { File, FileImage, Files, ImageDown, UploadCloud, X } from 'lucide-react'
import type { Tool } from './catalog'
import { Button, Empty, SaveButton, UploadButton, messageOf } from '../components/ui'
import { detectLanguage, fileSize, readText } from '../lib/files'
import { isSafeName } from '../lib/workspace'
import CodeEditor from '../editors/CodeEditor'

const convert = ['image-compress', 'png-jpg', 'jpg-png', 'image-webp', 'webp-png']
const formats = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' } as const
type ImageFormat = keyof typeof formats
const imageExtension = /\.(?:png|jpe?g|gif|bmp|webp|avif|ico)$/i
const raster = (file: File) => /^image\/(?:png|jpeg|gif|bmp|webp|avif|x-icon|vnd\.microsoft\.icon)$/i.test(file.type) || imageExtension.test(file.name)

async function makeImage(file: File, type: ImageFormat, quality: number) {
  const image = await createImageBitmap(file)
  try {
    if (image.width * image.height > 25_000_000 || image.width > 8192 || image.height > 8192) throw new Error('La imagen supera 25 megapíxeles o 8192 px por lado.')
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(image.width, image.height) : Object.assign(document.createElement('canvas'), { width: image.width, height: image.height })
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!context) throw new Error('Este navegador no admite la conversión de imágenes.')
    if (type === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height) }
    context.drawImage(image, 0, 0)
    const blob = canvas instanceof HTMLCanvasElement ? await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality)) : await canvas.convertToBlob({ type, quality })
    if (!blob || blob.type !== type) throw new Error(`El navegador no puede exportar ${formats[type].toUpperCase()}.`)
    return { blob, width: canvas.width, height: canvas.height, name: `${file.name.replace(/\.[^.]+$/, '')}.${formats[type]}` }
  } finally { image.close() }
}

function FileDetails({ file }: { file: File }) {
  return <dl className="file-details"><dt>Nombre</dt><dd>{file.name}</dd><dt>Tamaño</dt><dd>{fileSize(file.size)} ({file.size} bytes)</dd><dt>Tipo MIME informado</dt><dd>{file.type || 'Desconocido'}</dd><dt>Modificado</dt><dd>{new Date(file.lastModified).toLocaleString('es')}</dd></dl>
}

function ObjectImage({ file, alt }: { file: Blob; alt: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const address = URL.createObjectURL(file); setUrl(address); return () => URL.revokeObjectURL(address) }, [file])
  return url ? <img className="file-image" src={url} alt={alt} /> : null
}

export default function FileTool({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<File[]>([])
  const [active, setActive] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [type, setType] = useState<ImageFormat>('image/webp')
  const [quality, setQuality] = useState(82)
  const [name, setName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [output, setOutput] = useState<Awaited<ReturnType<typeof makeImage>>>()
  const [metadata, setMetadata] = useState('')
  const file = files[active]
  const multiple = tool.id === 'file-drop'
  const conversion = convert.includes(tool.id)
  const target = tool.id === 'image-compress' ? type : tool.id === 'image-webp' ? 'image/webp' : tool.id === 'png-jpg' ? 'image/jpeg' : 'image/png'
  const expected = tool.id === 'png-jpg' ? { mime: 'image/png', extension: /\.png$/i } : tool.id === 'jpg-png' ? { mime: 'image/jpeg', extension: /\.jpe?g$/i } : tool.id === 'webp-png' ? { mime: 'image/webp', extension: /\.webp$/i } : undefined
  const version = useRef(0)

  useEffect(() => {
    let current = true
    setText(null); setMetadata(''); setOutput(undefined); setName(file?.name ?? '')
    if (!file) return
    if (tool.id === 'metadata') {
      setProcessing(true)
      if (file.size > 30 * 1024 * 1024) { setError('Los metadatos se pueden leer en archivos de hasta 30 MB.'); setProcessing(false); return }
      void import('exifr').then(module => module.default.parse(file, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: true })).then(result => {
        if (current) setMetadata(result && Object.keys(result).length ? JSON.stringify(result, (_key, item) => ArrayBuffer.isView(item) ? `[datos binarios · ${item.byteLength} bytes]` : item, 2) : 'No se encontraron metadatos compatibles.')
      }, failure => { if (current) setError(`No se pudieron leer metadatos de este formato: ${messageOf(failure)}`) }).finally(() => { if (current) setProcessing(false) })
    } else if ((tool.id === 'file-view' || multiple) && !raster(file)) {
      void readText(file).then(content => { if (current) setText(content) }, () => { if (current) setError('Este formato no se puede previsualizar. Puedes consultar sus datos o descargar el original.') })
    }
    return () => { current = false }
  }, [file, tool.id, multiple])

  const load = (items: File[]) => {
    if (!items.length) return
    version.current++; setError(''); setProcessing(false); setOutput(undefined)
    setFiles(multiple ? items.slice(0, 50) : [items[0]]); setActive(0)
  }
  const process = async () => {
    if (!file) return
    const run = ++version.current
    setError(''); setProcessing(true); setOutput(undefined)
    try {
      if (file.size > 30 * 1024 * 1024 || !raster(file)) throw new Error('Selecciona una imagen rasterizada de hasta 30 MB.')
      if (expected && file.type !== expected.mime && (file.type.startsWith('image/') || !expected.extension.test(file.name))) throw new Error(`Selecciona una imagen ${expected.mime.split('/')[1].toUpperCase()}.`)
      const result = await makeImage(file, target, quality / 100)
      if (version.current === run) setOutput(result)
    } catch (failure) { if (version.current === run) setError(messageOf(failure)) }
    finally { if (version.current === run) setProcessing(false) }
  }

  return <>
    <section className={`panel file-drop ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => {
      event.preventDefault(); setDragging(false); load(Array.from(event.dataTransfer.files))
    }}><UploadCloud size={33} /><strong>Arrastra {multiple ? 'los archivos' : 'un archivo'} aquí</strong><p>El archivo se lee en este navegador, no se sube a un servidor.</p><UploadButton multiple={multiple} accept={conversion ? expected?.mime ?? 'image/*' : undefined} onFiles={load} label={multiple ? 'Seleccionar archivos' : 'Seleccionar archivo'} /></section>
    {file && <>
      <div className="operation-actions toolbar">
        <Button onClick={() => { version.current++; setFiles([]); setError(''); setProcessing(false) }}><X />Quitar {multiple ? 'archivos' : 'archivo'}</Button>
        {multiple && <select aria-label="Archivo activo" value={active} onChange={event => { setError(''); setActive(Number(event.target.value)) }}>{files.map((item, index) => <option key={`${item.name}:${index}`} value={index}>{item.name}</option>)}</select>}
        {conversion && <>{tool.id === 'image-compress' && <label className="inline-label">Formato<select value={type} onChange={event => { setType(event.target.value as ImageFormat); setOutput(undefined) }}><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option></select></label>}{target !== 'image/png' && <label className="inline-label">Calidad {quality}%<input type="range" min={5} max={100} value={quality} onChange={event => { setQuality(Number(event.target.value)); setOutput(undefined) }} /></label>}<Button kind="primary" disabled={processing} onClick={() => void process()}><ImageDown />{processing ? 'Convirtiendo…' : 'Convertir imagen'}</Button></>}
        {tool.id === 'file-export' ? <><label className="inline-label">Nombre de exportación<input value={name} onChange={event => setName(event.target.value)} /></label>{isSafeName(name) ? <SaveButton value={file} name={name} type={file.type} /> : <span className="hint">Introduce un nombre válido.</span>}</> : !conversion && <SaveButton value={file} name={file.name} type={file.type} />}
      </div>
      <div className="tool-panels">
        <section className="panel"><div className="panel-bar"><File />Archivo original</div><FileDetails file={file} />{(multiple || tool.id === 'file-view') && raster(file) && <ObjectImage file={file} alt={file.name} />}</section>
        {(conversion || tool.id === 'metadata' || text !== null) && <section className="panel"><div className="panel-bar"><FileImage />{tool.id === 'metadata' ? 'Metadatos' : conversion ? 'Imagen convertida' : 'Contenido'}</div>
          {output ? <><ObjectImage file={output.blob} alt="Imagen convertida" /><p className="file-summary">{output.width} × {output.height} px · {fileSize(output.blob.size)}{output.blob.size < file.size ? ` · ${Math.round((1 - output.blob.size / file.size) * 100)}% menos` : output.blob.size > file.size ? ' · mayor que el original' : ''}</p><div className="output-actions toolbar"><SaveButton value={output.blob} name={output.name} type={output.blob.type} /></div></> : metadata || text !== null ? <div className="tool-editor"><CodeEditor value={text ?? metadata} language={text !== null ? detectLanguage(file.name) : metadata.startsWith('{') ? 'json' : 'text'} label="Contenido del archivo" readOnly /></div> : <Empty title={processing ? 'Procesando archivo…' : 'Sin resultado'} detail={processing ? 'La operación se realiza en tu navegador.' : 'Aparece aquí cuando se procesa el archivo.'} icon={<Files />} />}
        </section>}
      </div>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
  </>
}
