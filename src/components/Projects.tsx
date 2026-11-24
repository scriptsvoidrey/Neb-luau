import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileCode2, Folder, FolderOpen, FolderPlus, History, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import CodeEditor from '../editors/CodeEditor'
import { detectLanguage, download, readText } from '../lib/files'
import { createProject, exportProject, importProject, isSafeName, withRevision, type Project, type ProjectNode } from '../lib/workspace'
import type { useStored } from '../hooks/useStored'
import { Button, Empty, messageOf, NameDialog, PageHeading, UploadButton } from './ui'

interface DialogAction { title: string; initial?: string; submit: (name: string) => void }

function descendants(entries: ProjectNode[], id: string) {
  const ids = new Set([id])
  for (let size = 0; size !== ids.size;) {
    size = ids.size
    for (const entry of entries) if (entry.parent !== null && ids.has(entry.parent)) ids.add(entry.id)
  }
  return ids
}

function pathFor(entries: ProjectNode[], entry: ProjectNode) {
  const names = [entry.name]
  for (let parent = entry.parent; parent !== null;) {
    const folder = entries.find(item => item.id === parent)
    if (!folder) break
    names.unshift(folder.name)
    parent = folder.parent
  }
  return names.join('/')
}

export default function Projects({ store }: { store: ReturnType<typeof useStored<Project[]>> }) {
  const { value: projects, update, status, persist } = store
  const [selected, setSelected] = useState('')
  const [selectedEntry, setSelectedEntry] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogAction>()
  const [error, setError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const pending = useRef<{ id: string; timer: number } | undefined>(undefined)
  const project = projects.find(item => item.id === selected) ?? projects[0]
  const entry = project?.entries.find(item => item.id === selectedEntry)
  const currentFolder = entry?.folder ? entry.id : entry?.parent ?? null

  const flushHistory = () => {
    const record = pending.current
    if (!record) return
    window.clearTimeout(record.timer)
    pending.current = undefined
    update(items => items.map(item => item.id === record.id ? withRevision(item, 'Autoguardado') : item))
  }
  const flushRef = useRef(flushHistory)
  flushRef.current = flushHistory
  useEffect(() => {
    const flush = () => flushRef.current()
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [])

  const patch = (id: string, operation: (item: Project) => Project, label?: string) => {
    update(items => items.map(item => {
      if (item.id !== id) return item
      const next = operation(item)
      return label ? withRevision(next, label) : { ...next, updated: Date.now() }
    }))
  }
  const addProject = (item: Project) => {
    flushHistory()
    update(items => [item, ...items]); setSelected(item.id); setSelectedEntry(''); setHistoryOpen(false)
  }
  const unique = (name: string, parent: string | null, id?: string) => {
    if (project?.entries.some(item => item.parent === parent && item.name === name && item.id !== id)) throw new Error('Ya existe un elemento con ese nombre en la carpeta.')
  }
  const addNode = (folder: boolean) => {
    if (!project) return
    setDialog({ title: folder ? 'Nueva carpeta' : 'Nuevo archivo', initial: folder ? '' : 'script.luau', submit: name => {
      unique(name, currentFolder)
      const node = { id: crypto.randomUUID(), parent: currentFolder, name, folder, content: '' }
      patch(project.id, item => ({ ...item, entries: [...item.entries, node] }), folder ? 'Carpeta creada' : 'Archivo creado')
      setSelectedEntry(node.id)
      if (currentFolder) setCollapsed(previous => { const next = new Set(previous); next.delete(currentFolder); return next })
    } })
  }
  const importFiles = async (files: File[]) => {
    if (!project || !files.length) return
    setError('')
    try {
      const existing = new Set(project.entries.filter(item => item.parent === currentFolder).map(item => item.name))
      const entries: ProjectNode[] = []
      for (const file of files.slice(0, 25)) {
        if (!isSafeName(file.name) || existing.has(file.name)) throw new Error(`El nombre «${file.name}» no es válido o ya existe en la carpeta.`)
        existing.add(file.name)
        entries.push({ id: crypto.randomUUID(), parent: currentFolder, name: file.name, folder: false, content: await readText(file) })
      }
      patch(project.id, item => ({ ...item, entries: [...item.entries, ...entries] }), 'Archivos importados')
      setSelectedEntry(entries[0].id)
    } catch (failure) { setError(messageOf(failure)) }
  }
  const edit = (content: string) => {
    if (!project || !entry) return
    if (pending.current?.id !== project.id) flushHistory()
    window.clearTimeout(pending.current?.timer)
    patch(project.id, item => ({ ...item, entries: item.entries.map(node => node.id === entry.id ? { ...node, content } : node) }))
    pending.current = { id: project.id, timer: window.setTimeout(() => flushRef.current(), 950) }
  }
  const tree = (parent: string | null, level: number) => project?.entries.filter(item => item.parent === parent).sort((first, second) => Number(second.folder) - Number(first.folder) || first.name.localeCompare(second.name)).map(node => <div key={node.id}>
    <button type="button" className={`tree-item ${node.id === entry?.id ? 'active' : ''}`} style={{ paddingInlineStart: `${10 + Math.min(level, 8) * 12}px` }} onClick={() => {
      setSelectedEntry(node.id)
      if (node.folder && node.id === entry?.id) setCollapsed(previous => { const next = new Set(previous); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next })
    }} title={node.folder ? 'Seleccionar carpeta; pulsa de nuevo para plegar o desplegar' : node.name}>
      {node.folder ? collapsed.has(node.id) ? <Folder /> : <FolderOpen /> : <FileCode2 />}<span>{node.name}</span>{node.folder && <ChevronDown className={collapsed.has(node.id) ? 'collapsed' : ''} />}
    </button>
    {node.folder && !collapsed.has(node.id) && tree(node.id, level + 1)}
  </div>)

  const excluded = project && entry ? descendants(project.entries, entry.id) : new Set<string>()
  return <>
    <PageHeading eyebrow="ESPACIO DE TRABAJO" title="Proyectos" description="Organiza carpetas y archivos de texto en este dispositivo. Exporta una copia antes de borrar los datos del navegador." actions={<>
      <UploadButton label="Importar proyecto" accept=".json,application/json" onFiles={files => {
        if (!files[0]) return
        setError(''); void readText(files[0], 12 * 1024 * 1024).then(source => addProject(importProject(source))).catch(failure => setError(messageOf(failure)))
      }} />
      <Button kind="primary" onClick={() => setDialog({ title: 'Nuevo proyecto', submit: name => addProject(withRevision(createProject(name), 'Proyecto creado')) })}><Plus />Nuevo proyecto</Button>
    </>} />
    {project ? <div className="project-layout">
      <section className="panel project-sidebar" aria-label="Explorador de proyectos">
        <div className="panel-bar"><FolderOpen />Explorador</div>
        <div className="project-controls">
          <select aria-label="Proyecto activo" value={project.id} onChange={event => { flushHistory(); setSelected(event.target.value); setSelectedEntry(''); setHistoryOpen(false) }}>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <div className="toolbar"><Button className="icon-button" title="Nuevo archivo" aria-label="Nuevo archivo" onClick={() => addNode(false)}><Plus /></Button><Button className="icon-button" title="Nueva carpeta" aria-label="Nueva carpeta" onClick={() => addNode(true)}><FolderPlus /></Button><UploadButton multiple onFiles={files => void importFiles(files)} /></div>
        </div>
        <button className={`tree-item root-node ${!entry ? 'active' : ''}`} onClick={() => setSelectedEntry('')}><Folder />Raíz del proyecto</button>
        <div className="project-tree">{tree(null, 0)}</div>
      </section>
      <section className="panel project-main">
        <div className="editor-toolbar toolbar">
          <Button onClick={() => { flushHistory(); patch(project.id, item => item, 'Guardado manual'); persist() }}><Save />Guardar</Button>
          <Button onClick={() => download(exportProject(project), `${project.name}.neb.json`, 'application/json')}><Download />Exportar</Button>
          <Button aria-pressed={historyOpen} onClick={() => { flushHistory(); setHistoryOpen(!historyOpen) }}><History />Historial</Button>
          <Button className="icon-button" aria-label="Renombrar proyecto" title="Renombrar proyecto" onClick={() => setDialog({ title: 'Renombrar proyecto', initial: project.name, submit: name => patch(project.id, item => ({ ...item, name }), 'Proyecto renombrado') })}><Pencil /></Button>
          <Button className="icon-button" kind="danger" aria-label="Eliminar proyecto" title="Eliminar proyecto" onClick={() => {
            if (window.confirm(`¿Eliminar el proyecto «${project.name}» de este navegador?`)) { flushHistory(); update(items => items.filter(item => item.id !== project.id)); setSelectedEntry(''); setHistoryOpen(false) }
          }}><Trash2 /></Button>
        </div>
        {historyOpen && <section className="history"><h2>Historial local</h2>{!project.history.length && <p>Aún no hay revisiones.</p>}{project.history.map(revision => <div key={revision.id}><span><strong>{revision.label}</strong><time dateTime={new Date(revision.at).toISOString()}>{new Date(revision.at).toLocaleString('es')}</time></span><Button onClick={() => {
          if (window.confirm('¿Restaurar esta revisión?')) { flushHistory(); patch(project.id, item => ({ ...item, name: revision.name, entries: revision.entries }), 'Revisión restaurada'); setSelectedEntry('') }
        }}>Restaurar</Button></div>)}</section>}
        {entry && <><div className="node-toolbar toolbar">
          <strong className="node-path">{pathFor(project.entries, entry)}</strong>
          <Button className="icon-button" title="Renombrar elemento" aria-label="Renombrar elemento" onClick={() => setDialog({ title: `Renombrar ${entry.folder ? 'carpeta' : 'archivo'}`, initial: entry.name, submit: name => {
            unique(name, entry.parent, entry.id)
            patch(project.id, item => ({ ...item, entries: item.entries.map(node => node.id === entry.id ? { ...node, name } : node) }), 'Elemento renombrado')
          } })}><Pencil /></Button>
          <select aria-label="Mover a carpeta" value={entry.parent ?? ''} onChange={event => {
            const target = event.target.value || null
            try { unique(entry.name, target, entry.id); patch(project.id, item => ({ ...item, entries: item.entries.map(node => node.id === entry.id ? { ...node, parent: target } : node) }), 'Elemento movido'); setError('') }
            catch (failure) { setError(messageOf(failure)) }
          }}><option value="">Raíz /</option>{project.entries.filter(node => node.folder && !excluded.has(node.id)).map(node => <option key={node.id} value={node.id}>{pathFor(project.entries, node)}</option>)}</select>
          <Button className="icon-button" kind="danger" title="Eliminar elemento" aria-label="Eliminar elemento" onClick={() => {
            if (window.confirm(`¿Eliminar «${entry.name}»${entry.folder ? ' y su contenido' : ''}?`)) { flushHistory(); patch(project.id, item => ({ ...item, entries: item.entries.filter(node => !excluded.has(node.id)) }), 'Elemento eliminado'); setSelectedEntry('') }
          }}><Trash2 /></Button>
        </div>
        {!entry.folder && <div className="workspace-editor"><CodeEditor key={`${project.id}:${entry.id}`} value={entry.content} language={detectLanguage(entry.name)} diagnostics label={`Contenido de ${entry.name}`} onChange={edit} /></div>}</>}
        {(!entry || entry.folder) && <Empty title={entry?.name ?? project.name} detail="Abre un archivo de texto o crea uno desde el explorador." icon={<FolderOpen />} />}
        <div className="editor-status"><span>{project.entries.filter(item => !item.folder).length} archivos</span><span>{status === 'error' ? 'No guardado' : status === 'saving' ? 'Guardando…' : 'Guardado local'}</span></div>
      </section>
    </div> : <div className="panel"><Empty title={status === 'loading' ? 'Cargando proyectos…' : 'Aún no hay proyectos'} detail="Crea un proyecto o importa una copia de NEB LUAU." icon={<FolderOpen />} /></div>}
    {(error || status === 'error') && <p role="alert" className="error">{error || 'El navegador no pudo guardar los cambios. Exporta una copia del proyecto.'}</p>}
    {dialog && <NameDialog title={dialog.title} initial={dialog.initial} onSubmit={dialog.submit} onClose={() => setDialog(undefined)} />}
  </>
}
