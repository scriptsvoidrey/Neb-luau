import { detectLanguage, maybeLanguage } from './files'
import type { Language } from '../tools/catalog'

export interface DocumentFile { id: string; name: string; content: string; language: Language }
export interface ProjectNode { id: string; parent: string | null; name: string; content: string; folder: boolean }
export interface Revision { id: string; at: number; label: string; name: string; entries: ProjectNode[] }
export interface Project { id: string; name: string; entries: ProjectNode[]; history: Revision[]; updated: number }

let database: Promise<IDBDatabase> | undefined
function connect() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('neb-luau-workspace', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('workspace')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Cierra otras pestañas de NEB LUAU para abrir el almacenamiento.'))
  }).catch(error => { database = undefined; throw error })
  return database
}

export async function load<T>(key: string): Promise<T | undefined> {
  const connection = await connect()
  return new Promise((resolve, reject) => {
    const request = connection.transaction('workspace').objectStore('workspace').get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function save<T>(key: string, value: T): Promise<void> {
  const connection = await connect()
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction('workspace', 'readwrite')
    transaction.objectStore('workspace').put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onabort = transaction.onerror = () => reject(transaction.error)
  })
}

export function createDocument(name: string, content = '', language = detectLanguage(name)): DocumentFile {
  return { id: crypto.randomUUID(), name, content, language }
}

export function createProject(name: string): Project {
  return { id: crypto.randomUUID(), name, entries: [], history: [], updated: Date.now() }
}

export function withRevision(project: Project, label: string): Project {
  const latest = project.history[0]
  if (latest?.name === project.name && (latest.entries === project.entries || JSON.stringify(latest.entries) === JSON.stringify(project.entries))) return project
  const revision: Revision = { id: crypto.randomUUID(), at: Date.now(), label, name: project.name, entries: project.entries }
  const history: Revision[] = [revision]
  let total = JSON.stringify(revision).length
  for (const older of project.history) {
    total += JSON.stringify(older).length
    if (history.length >= 20 || total > 8_000_000) break
    history.push(older)
  }
  return { ...project, history, updated: revision.at }
}

export function isSafeName(value: string) {
  return Boolean(value.trim()) && value.length <= 140 && value !== '.' && value !== '..' && !/[\\/\u0000-\u001F\u007F]/.test(value)
}

export function importProject(source: string): Project {
  const data = JSON.parse(source)
  if (data?.format !== 'neb-luau-project' || data.version !== 1 || typeof data.name !== 'string' || !isSafeName(data.name) || !Array.isArray(data.entries) || data.entries.length > 1000) {
    throw new Error('Selecciona un proyecto exportado desde NEB LUAU (formato versión 1).')
  }
  const entries: ProjectNode[] = data.entries.map((entry: Partial<ProjectNode>) => {
    if (!entry || typeof entry.id !== 'string' || (entry.parent !== null && typeof entry.parent !== 'string') || typeof entry.folder !== 'boolean' || typeof entry.name !== 'string' || !isSafeName(entry.name) || typeof entry.content !== 'string' || entry.content.length > 4_194_304) {
      throw new Error('Una entrada del proyecto no es válida.')
    }
    return { id: entry.id, parent: entry.parent, name: entry.name, folder: entry.folder, content: entry.folder ? '' : entry.content }
  })
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const siblings = new Set<string>()
  if (byId.size !== entries.length) throw new Error('El proyecto contiene identificadores duplicados.')
  for (const entry of entries) {
    const siblingKey = JSON.stringify([entry.parent, entry.name])
    if (siblings.has(siblingKey)) throw new Error('Hay nombres duplicados en una carpeta.')
    siblings.add(siblingKey)
    const parents = new Set([entry.id])
    for (let next = entry.parent; next !== null;) {
      const parent = byId.get(next)
      if (!parent?.folder || parents.has(next) || parents.size > 75) throw new Error('La jerarquía de carpetas no es válida.')
      parents.add(next)
      next = parent.parent
    }
  }
  return withRevision({ ...createProject(data.name), entries }, 'Importación')
}

export function exportProject(project: Project) {
  return JSON.stringify({ format: 'neb-luau-project', version: 1, name: project.name, entries: project.entries }, null, 2)
}

export function restoreLanguage(file: DocumentFile) {
  return maybeLanguage(file.language) ?? detectLanguage(file.name)
}
