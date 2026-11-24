import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, CircleHelp, LoaderCircle } from 'lucide-react'
import Layout from './components/Layout'
import Dashboard, { CatalogPage, categoryIcons } from './components/Dashboard'
import { Button, Empty, PageHeading } from './components/ui'
import { useStored } from './hooks/useStored'
import { createDocument, type Project } from './lib/workspace'
import { extensionFor } from './lib/files'
import { categories, samples, searchTools, tools, type Language } from './tools/catalog'
import type { Tabs } from './editors/EditorWorkspace'
import type { EditorSession } from './editors/CodeEditor'

const EditorWorkspace = lazy(() => import('./editors/EditorWorkspace'))
const Projects = lazy(() => import('./components/Projects'))
const OperationTool = lazy(() => import('./tools/OperationTool'))
const PreviewTool = lazy(() => import('./tools/PreviewTool'))
const FileTool = lazy(() => import('./tools/FileTool'))
const DesignTool = lazy(() => import('./tools/DesignTool'))

const starter = { id: 'first-file', name: 'main.luau', language: 'luau', content: samples.luau ?? '' } as const
const initialTabs: Tabs = { files: [starter], active: starter.id }
const routeFromLocation = () => location.hash.startsWith('#/') ? location.hash.slice(1).split('?')[0] : '/'

class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <div className="panel"><Empty title="No se pudo cargar esta pantalla" detail="Vuelve al catálogo o recarga la aplicación." /><div className="catalog-footer"><Button onClick={() => location.reload()}>Recargar</Button></div></div>
  }
}

export default function App() {
  const [route, setRoute] = useState(routeFromLocation)
  const editorStates = useRef(new Map<string, EditorSession>())
  const tabs = useStored<Tabs>('editor:tabs', initialTabs)
  const projects = useStored<Project[]>('workspace:projects', [])
  const [section, id] = route.split('/').slice(1)
  const tool = section === 'herramienta' ? tools.find(item => item.id === id) : undefined
  const category = section === 'categoria' ? categories.find(item => item.id === id) : undefined
  const toolCategory = tool && categories.find(item => item.id === tool.category)
  const editorRoute = section === 'editor' || tool?.id === 'lua-editor'
  const heading = editorRoute ? 'Editor' : tool?.name ?? category?.label ?? ({ proyectos: 'Proyectos', catalogo: 'Catálogo', buscar: 'Búsqueda' }[section] ?? 'Panel principal')
  let query = ''
  if (section === 'buscar') { try { query = decodeURIComponent(id ?? '') } catch { query = id ?? '' } }

  useEffect(() => {
    const navigate = () => { setRoute(routeFromLocation()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => { document.title = `${heading} — NEB LUAU` }, [heading])

  const openEditor = (content: string, language: Language, name = `resultado.${extensionFor(language)}`) => {
    const document = createDocument(name, content, language)
    tabs.update(previous => ({ files: [...previous.files, document], active: document.id }))
    location.hash = '/editor'
  }
  const ToolIcon = tool && categoryIcons[tool.category]
  let page
  if (editorRoute) page = <EditorWorkspace store={tabs} states={editorStates} />
  else if (section === 'proyectos') page = <Projects store={projects} />
  else if (tool) page = <div key={tool.id}>
    <a href={`#/categoria/${tool.category}`} className="back-link"><ArrowLeft size={15} />{toolCategory?.label}</a>
    <PageHeading eyebrow={toolCategory?.label.toUpperCase() ?? 'HERRAMIENTA'} title={tool.name} description={tool.description} actions={ToolIcon ? <span className={`tool-icon page-tool-icon ${tool.category}`}><ToolIcon size={28} /></span> : undefined} />
    {tool.kind === 'preview' ? <PreviewTool tool={tool} /> : tool.kind === 'design' ? <DesignTool tool={tool} /> : tool.kind === 'file' ? <FileTool tool={tool} /> : <OperationTool tool={tool} openEditor={openEditor} />}
  </div>
  else if (category || section === 'catalogo') page = <CatalogPage category={category?.id} />
  else if (section === 'buscar') page = <CatalogPage query={query} results={searchTools(query)} />
  else if (route === '/') page = <Dashboard />
  else page = <div className="panel"><Empty title="Página no encontrada" detail="Abre el catálogo para encontrar la herramienta que buscas." icon={<CircleHelp />} /><div className="catalog-footer"><a className="button primary" href="#/catalogo">Volver al catálogo</a></div></div>

  return <Layout heading={heading} route={route} parent={toolCategory ? { label: toolCategory.label, href: `#/categoria/${toolCategory.id}` } : undefined}>
    <RouteBoundary key={route}><Suspense fallback={<div className="loading" role="status"><LoaderCircle size={20} />Cargando espacio de trabajo…</div>}>{page}</Suspense></RouteBoundary>
  </Layout>
}
