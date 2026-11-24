import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Copy, Download, FileCode2, FileUp } from 'lucide-react'
import { copy, download } from '../lib/files'
import { isSafeName } from '../lib/workspace'

export function Button({ children, kind = '', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'danger' | '' }) {
  return <button type="button" {...props} className={`button ${kind} ${className}`.trim()}>{children}</button>
}

export const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)

export function CopyButton({ value, onError }: { value: string; onError: (message: string) => void }) {
  const [copied, setCopied] = useState(false)
  const timeout = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timeout.current), [])
  return <Button onClick={() => void copy(value).then(() => {
    setCopied(true)
    window.clearTimeout(timeout.current)
    timeout.current = window.setTimeout(() => setCopied(false), 1400)
  }, error => onError(messageOf(error)))}>{copied ? <Check /> : <Copy />}{copied ? 'Copiado' : 'Copiar'}</Button>
}

export function SaveButton({ value, name, type }: { value: BlobPart; name: string; type?: string }) {
  return <Button onClick={() => download(value, name, type)}><Download />Descargar</Button>
}

export function UploadButton({ onFiles, accept, multiple, label = 'Importar archivo' }: { onFiles: (files: File[]) => void; accept?: string; multiple?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  return <><Button onClick={() => input.current?.click()}><FileUp />{label}</Button><input hidden ref={input} type="file" accept={accept} multiple={multiple} onChange={event => {
    onFiles(Array.from(event.currentTarget.files ?? []))
    event.currentTarget.value = ''
  }} /></>
}

export function Empty({ title, detail, icon }: { title: string; detail: string; icon?: ReactNode }) {
  return <div className="empty"><span className="empty-icon">{icon ?? <FileCode2 size={23} />}</span><strong>{title}</strong><span>{detail}</span></div>
}

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-heading"><div><p className="eyebrow"><ChevronRight size={12} />{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions && <div className="toolbar">{actions}</div>}</header>
}

export function NameDialog({ title, initial = '', onClose, onSubmit }: { title: string; initial?: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(initial)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog className="dialog" ref={dialog} onCancel={onClose} aria-label={title}>
    <form onSubmit={event => {
      event.preventDefault()
      const name = value.trim()
      if (!isSafeName(name)) { setError('Escribe un nombre válido, sin barras.'); return }
      try { onSubmit(name); onClose() } catch (failure) { setError(messageOf(failure)) }
    }}><h2>{title}</h2><label>Nombre<input autoFocus value={value} maxLength={140} onChange={event => setValue(event.target.value)} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="toolbar"><Button onClick={onClose}>Cancelar</Button><Button type="submit" kind="primary">Guardar</Button></div>
    </form>
  </dialog>
}
