import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowRight, ChevronRight, Command, FolderOpen, LayoutGrid, Menu, Search, ShieldCheck, SquareTerminal, X } from 'lucide-react'
import { categories, searchTools, tools } from '../tools/catalog'
import { categoryIcons } from './Dashboard'

const workspace = [
  { href: '#/', label: 'Panel principal', Icon: LayoutGrid },
  { href: '#/editor', label: 'Editor de código', Icon: SquareTerminal },
  { href: '#/proyectos', label: 'Proyectos', Icon: FolderOpen },
]

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const matches = query.trim() ? searchTools(query) : tools.filter(tool => ['lua-format', 'luau-format', 'json-format', 'html-playground'].includes(tool.id))
  const shown = matches.slice(0, 7)
  useEffect(() => {
    const hotkey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.current?.focus(); setOpen(true) }
    }
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false) }
    window.addEventListener('keydown', hotkey); document.addEventListener('pointerdown', outside)
    return () => { window.removeEventListener('keydown', hotkey); document.removeEventListener('pointerdown', outside) }
  }, [])
  const close = () => { setOpen(false); setQuery(''); input.current?.blur() }
  return <div className="global-search" ref={wrapper}>
    <Search size={16} />
    <input type="search" aria-label="Buscar herramientas" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? 'global-tool-results' : undefined} aria-activedescendant={open && shown[selected] ? `tool-result-${shown[selected].id}` : undefined} ref={input} value={query} placeholder="Buscar herramientas…" onChange={event => { setQuery(event.target.value); setSelected(0); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={event => { if (!wrapper.current?.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); if (shown.length) setSelected(previous => (previous + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length) }
      else if (event.key === 'Enter') {
        event.preventDefault()
        if (open && shown[selected]) { location.hash = `/herramienta/${shown[selected].id}`; close() }
        else if (query.trim()) { location.hash = `/buscar/${encodeURIComponent(query.trim())}`; close() }
      }
    }} />
    <kbd className="search-shortcut"><Command size={11} /> K</kbd>
    {open && <div className="search-results">
      <div className="search-caption">{query.trim() ? `${matches.length} resultados` : 'Sugerencias'}</div>
      <div role="listbox" id="global-tool-results" aria-label="Resultados">{shown.map((tool, index) => {
        const Icon = categoryIcons[tool.category]
        return <a href={`#/herramienta/${tool.id}`} role="option" aria-selected={selected === index} key={tool.id} id={`tool-result-${tool.id}`} className={selected === index ? 'selected' : ''} onMouseEnter={() => setSelected(index)} onClick={close}><Icon size={16} /><span>{tool.name}</span><small>{categories.find(category => category.id === tool.category)?.short}</small></a>
      })}</div>
      {!shown.length && <p className="search-empty">No encontramos coincidencias.</p>}
      {matches.length > shown.length && <a className="search-all" href={`#/buscar/${encodeURIComponent(query.trim())}`} onClick={close}>Ver todos los resultados <ArrowRight size={15} /></a>}
      {shown.length > 0 && <div className="search-hints"><ArrowDown size={12} /> Navegar <kbd>Enter</kbd> Abrir</div>}
    </div>}
  </div>
}

export default function Layout({ route, heading, parent, children }: { route: string; heading: string; parent?: { label: string; href: string }; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  const menu = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!drawer) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDrawer(false); menu.current?.focus() } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [drawer])
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Ir al contenido</a>
    {drawer && <button type="button" className="drawer-overlay" onClick={() => setDrawer(false)} aria-label="Cerrar navegación" />}
    <aside className={`sidebar ${drawer ? 'visible' : ''}`} id="site-navigation">
      <a href="#/" onClick={() => setDrawer(false)} className="brand"><img src="/neb.svg" width="39" height="39" alt="" /><span><strong>NEB <em>LUAU</em></strong><small>DEV WORKSPACE</small></span></a>
      <nav aria-label="Navegación principal">
        <div className="nav-section"><p>ESPACIO DE TRABAJO</p>{workspace.map(({ label, Icon, href }) => <a href={href} key={href} onClick={() => setDrawer(false)} aria-current={route === href.slice(1) ? 'page' : undefined}><Icon size={17} /><span>{label}</span>{route === href.slice(1) && <span className="nav-marker" />}</a>)}</div>
        <div className="nav-section"><p>CATEGORÍAS</p>{categories.map(category => {
          const href = `#/categoria/${category.id}`
          const Icon = categoryIcons[category.id]
          const active = route === href.slice(1) || parent?.href === href
          return <a href={href} key={href} onClick={() => setDrawer(false)} aria-current={active ? 'page' : undefined}><Icon size={17} /><span>{category.short}</span><small>{tools.filter(tool => tool.category === category.id).length}</small></a>
        })}</div>
      </nav>
      <div className="sidebar-bottom"><span className="local-dot" /><div><strong>Modo local</strong><small>Sin cuenta. Sin servidor.</small></div><span className="sidebar-version">v1.0</span></div>
    </aside>
    <div className="app-main">
      <header className="topbar">
        <button ref={menu} type="button" className="mobile-menu" aria-expanded={drawer} aria-controls="site-navigation" aria-label={drawer ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setDrawer(!drawer)}>{drawer ? <X size={20} /> : <Menu size={20} />}</button>
        <div className="breadcrumbs"><a href="#/">Espacio de trabajo</a><ChevronRight size={13} />{parent && <><a href={parent.href}>{parent.label}</a><ChevronRight size={13} /></>}<span>{heading}</span></div>
        <GlobalSearch />
        <span className="privacy-label" title="El procesamiento y el guardado son locales"><ShieldCheck size={15} /> En tu navegador</span>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
      <footer className="app-footer"><span>NEB LUAU</span><span>Utilidades de desarrollo · Procesamiento local</span></footer>
    </div>
  </div>
}
