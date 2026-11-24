import type { Language } from '../tools/catalog'

const extensions: Record<Language, string> = {
  lua: 'lua', luau: 'luau', html: 'html', css: 'css', javascript: 'js', typescript: 'ts', json: 'json', xml: 'xml', python: 'py', sql: 'sql', markdown: 'md', text: 'txt',
}
export const languages = Object.keys(extensions) as Language[]
export const labels: Record<Language, string> = { lua: 'Lua', luau: 'Luau', html: 'HTML', css: 'CSS', javascript: 'JavaScript', typescript: 'TypeScript', json: 'JSON', xml: 'XML', python: 'Python', sql: 'SQL', markdown: 'Markdown', text: 'Texto' }
export const extensionFor = (language: Language) => extensions[language]
export const maybeLanguage = (value?: string) => languages.find(language => language === value)
export function detectLanguage(name: string): Language {
  const extension = name.split('.').at(-1)?.toLowerCase()
  if (extension === 'svg') return 'xml'
  if (extension === 'htm') return 'html'
  if (extension === 'mjs' || extension === 'cjs' || extension === 'jsx') return 'javascript'
  if (extension === 'tsx') return 'typescript'
  return languages.find(language => extensions[language] === extension) ?? 'text'
}

export function download(content: BlobPart, name: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copy(text: string) {
  if (!navigator.clipboard) throw new Error('El acceso al portapapeles requiere HTTPS. Puedes seleccionar el resultado y copiarlo manualmente.')
  await navigator.clipboard.writeText(text)
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / (bytes < 1048576 ? 1024 : 1048576)).toLocaleString('es', { maximumFractionDigits: 2 })} ${bytes < 1048576 ? 'KB' : 'MB'}`
}

export async function readText(file: File, limit = 4 * 1024 * 1024) {
  if (file.size > limit) throw new Error(`El archivo supera el límite de ${fileSize(limit)}.`)
  const buffer = await file.arrayBuffer()
  try {
    const data = new Uint8Array(buffer)
    const encoding = data[0] === 255 && data[1] === 254 ? 'utf-16le' : data[0] === 254 && data[1] === 255 ? 'utf-16be' : 'utf-8'
    const content = new TextDecoder(encoding, { fatal: true }).decode(data)
    if (content.includes('\0')) throw new Error('Contenido binario.')
    return content
  } catch { throw new Error('No se pudo leer como texto. Usa un archivo UTF-8 o UTF-16 con BOM.') }
}
