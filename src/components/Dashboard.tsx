import { ArrowDown, ArrowRight, ArrowUpRight, Braces, Code2, FileText, FolderOpen, Globe2, Layers3, Search, Terminal, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { categories, tools, type Category, type Tool } from '../tools/catalog'
import { Button, Empty, PageHeading } from './ui'

export const categoryIcons: Record<Category, LucideIcon> = { lua: Terminal, dev: Braces, web: Globe2, text: FileText, files: Layers3 }
export const categoryBadge: Record<Category, string> = { lua: 'LUA', dev: 'DEV', web: 'WEB', text: 'TEXTO', files: 'ARCHIVO' }

function OrbitDiagram() {
  return <svg className="orbit-diagram" viewBox="0 0 414 270" fill="none" aria-hidden="true">
    <defs>
      <pattern id="orbit-dots" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#9d8bdf" opacity=".32" /></pattern>
      <radialGradient id="orbit-field"><stop offset="0" stopColor="white"/><stop offset=".8" stopColor="white" stopOpacity=".38"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient>
      <mask id="orbit-mask"><ellipse cx="224" cy="138" rx="207" ry="135" fill="url(#orbit-field)"/></mask>
    </defs>
    <path d="M0 0h414v270H0z" fill="url(#orbit-dots)" mask="url(#orbit-mask)" />
    <g stroke="#8b78cc" strokeWidth="1" opacity=".42"><circle cx="218" cy="135" r="94" strokeDasharray="3 6"/><circle cx="218" cy="135" r="111" opacity=".45"/><path d="M218 12v247M70 135h294" strokeDasharray="2 7" opacity=".85"/><ellipse cx="218" cy="135" rx="138" ry="59" transform="rotate(-26 218 135)"/><ellipse cx="218" cy="135" rx="138" ry="59" transform="rotate(26 218 135)" opacity=".62"/></g>
    <circle cx="321" cy="78" r="5" fill="#bca8ff"/><circle cx="321" cy="78" r="10" stroke="#bca8ff" opacity=".33"/>
    <circle cx="110" cy="194" r="4" fill="#9676ec"/><circle cx="140" cy="74" r="3.5" fill="#a5a8f6" opacity=".8"/><circle cx="292" cy="196" r="2.5" fill="#bca8ff" />
    <path d="M348 137v12m-6-6h12M80 109v10m-5-5h10M284 36v8m-4-4h8M156 233v10m-5-5h10" stroke="#9877dc" opacity=".52" />
    <rect x="178" y="95" width="80" height="80" rx="20" fill="#241c3b" stroke="#6d5797" transform="rotate(-9 218 135)" />
    <rect x="183" y="100" width="70" height="70" rx="17" stroke="#a284e0" opacity=".24" transform="rotate(-9 218 135)" />
    <g stroke="#c1aaff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m205 125-10 10 10 10m26-20 10 10-10 10m-10-24-6 28"/></g>
    <text x="279" y="240" fill="#8c7cb5" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1.5">FIG. 01 / ÓRBITA</text>
    <text x="89" y="45" fill="#8c7cb5" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1.3">NEB.SYS</text>
  </svg>
}

const quick = [
  { title: 'Editor de código', detail: 'Editor Lua, Luau y más', href: '#/editor', Icon: Code2, color: 'lua' },
  { title: 'Luau Formatter', detail: 'Ordena tus scripts Luau', href: '#/herramienta/luau-format', Icon: Braces, color: 'dev' },
  { title: 'HTML Playground', detail: 'Prueba tu código web', href: '#/herramienta/html-playground', Icon: Globe2, color: 'web' },
  { title: 'Proyectos', detail: 'Organiza tus archivos', href: '#/proyectos', Icon: FolderOpen, color: 'files' },
]
const featured = ['lua-format', 'lua-check', 'json-format', 'html-playground', 'base64-encode', 'regex', 'diff', 'markdown', 'image-compress']

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = categoryIcons[tool.category]
  return <a className="tool-card" href={`#/herramienta/${tool.id}`}>
    <span className={`tool-icon ${tool.category}`}><Icon size={18} /></span>
    <span className="tool-copy"><strong>{tool.name}</strong><span>{tool.description}</span></span>
    <ArrowUpRight size={15} className="card-arrow" />
  </a>
}

function CategoryPicker({ active, onChange }: { active: Category | 'all'; onChange: (value: Category | 'all') => void }) {
  return <div className="category-picker" aria-label="Filtrar por categoría">
    <button type="button" aria-pressed={active === 'all'} onClick={() => onChange('all')}>Todas</button>
    {categories.map(category => { const Icon = categoryIcons[category.id]; return <button type="button" key={category.id} aria-pressed={active === category.id} onClick={() => onChange(category.id)}><Icon size={14} />{category.short}</button> })}
  </div>
}

export default function Dashboard() {
  const [category, setCategory] = useState<Category | 'all'>('all')
  const visible = category === 'all' ? featured.flatMap(id => tools.filter(tool => tool.id === id)) : tools.filter(tool => tool.category === category)
  return <>
    <section className="hero">
      <div className="hero-content">
        <p className="hero-kicker"><span />ESPACIO DE DESARROLLO</p>
        <h1>NEB <em>LUAU</em></h1>
        <p className="hero-description">Edita código, prueba ideas y organiza tus proyectos. Tus herramientas de desarrollo, en un solo lugar.</p>
        <div className="hero-actions"><a href="#/editor" className="button primary"><Code2 size={18} />Abrir editor<ArrowRight size={16} /></a><Button onClick={() => document.getElementById('tool-catalog')?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>Explorar herramientas<ArrowDown size={15} /></Button></div>
      </div>
      <OrbitDiagram />
    </section>
    <section className="dashboard-section quick-section">
      <header className="section-title"><h2>Acceso rápido</h2><span className="section-index">01 / ESPACIO DE TRABAJO</span></header>
      <div className="quick-grid">{quick.map(({ title, href, detail, Icon, color }) => <a className="quick-card" href={href} key={href}>
        <span className={`tool-icon ${color}`}><Icon size={19} /></span><span className="quick-arrow"><ArrowUpRight size={16} /></span><strong>{title}</strong><span>{detail}</span>
      </a>)}</div>
    </section>
    <section className="dashboard-section" id="tool-catalog">
      <header className="section-title"><div><h2>Explorar herramientas</h2><p>Encuentra la utilidad que necesitas para tu próximo paso.</p></div><span className="section-index">02 / CATÁLOGO</span></header>
      <CategoryPicker active={category} onChange={setCategory} />
      <div className="tool-grid">{visible.map(tool => <ToolCard key={tool.id} tool={tool} />)}</div>
      <div className="catalog-footer"><a href="#/catalogo" className="button">Ver las {tools.length} herramientas<ArrowRight size={16} /></a></div>
    </section>
  </>
}

export function CatalogPage({ category, results, query }: { category?: Category; results?: Tool[]; query?: string }) {
  const selected = categories.find(item => item.id === category)
  const visible = results ?? (category ? tools.filter(tool => tool.category === category) : tools)
  return <>
    <PageHeading eyebrow="CATÁLOGO" title={query ? `Resultados para «${query}»` : selected?.label ?? 'Catálogo de herramientas'} description={selected?.description ?? 'Utilidades para escribir, transformar y revisar contenido en tu navegador.'} actions={<span className="count-badge">{visible.length} {visible.length === 1 ? 'herramienta' : 'herramientas'}</span>} />
    {!query && <CategoryPicker active={category ?? 'all'} onChange={value => { location.hash = value === 'all' ? '/catalogo' : `/categoria/${value}` }} />}
    {visible.length ? <div className="tool-grid">{visible.map(tool => <ToolCard key={tool.id} tool={tool} />)}</div> : <div className="panel"><Empty title="No encontramos herramientas" detail="Prueba con otro término o abre el catálogo completo." icon={<Search />} /></div>}
  </>
}
