import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorState, Compartment, Transaction, type Extension } from '@codemirror/state'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import { StreamLanguage, syntaxTree, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { linter, type Diagnostic } from '@codemirror/lint'
import { completeFromList } from '@codemirror/autocomplete'
import { tags } from '@lezer/highlight'
import type { Language } from '../tools/catalog'
import { createRunner } from '../lib/worker'

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--editor)', color: 'var(--ink)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', fontSize: '13px', lineHeight: '1.8' },
  '.cm-gutters': { backgroundColor: 'var(--editor)', color: 'var(--muted)', border: 0, paddingRight: '7px' },
  '.cm-content': { padding: '13px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 12px 0 5px' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(160, 146, 212, .08)' },
  '.cm-panels, .cm-tooltip': { backgroundColor: 'var(--panel)', color: 'var(--ink)', borderColor: 'var(--line)' },
  '.cm-button, .cm-textfield': { color: 'var(--ink)', background: 'var(--editor)', borderColor: 'var(--line)' },
  '.cm-placeholder': { color: 'var(--muted)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground': { background: '#38304f !important' },
}, { dark: true })

const colors = syntaxHighlighting(HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: '#ba9dff' },
  { tag: [tags.string, tags.regexp, tags.inserted], color: '#a6d8ad' },
  { tag: [tags.number, tags.bool, tags.null], color: '#edbf8d' },
  { tag: [tags.comment], color: '#88869a', fontStyle: 'italic' },
  { tag: [tags.atom, tags.heading, tags.typeName], color: '#c9b8ff' },
  { tag: [tags.definition(tags.variableName), tags.function(tags.variableName), tags.tagName], color: '#94c9fa' },
  { tag: [tags.propertyName, tags.attributeName], color: '#e6b0d6' },
]))

const luaWords = 'and break do else elseif end false for function goto if in local nil not or repeat return then true until while assert error ipairs next pairs pcall print require select setmetatable tonumber tostring type xpcall coroutine math string table utf8'.split(' ')

async function extensions(language: Language): Promise<Extension> {
  switch (language) {
    case 'lua': case 'luau': {
      const { lua } = await import('@codemirror/legacy-modes/mode/lua')
      const words = language === 'luau' ? [...luaWords, 'continue', 'export', 'type', 'typeof', 'task'] : luaWords
      return [StreamLanguage.define(lua), EditorState.languageData.of(() => [{ autocomplete: completeFromList(words.map(label => ({ label }))) }])]
    }
    case 'javascript': case 'typescript': return (await import('@codemirror/lang-javascript')).javascript({ typescript: language === 'typescript', jsx: true })
    case 'html': return (await import('@codemirror/lang-html')).html()
    case 'css': return (await import('@codemirror/lang-css')).css()
    case 'json': return (await import('@codemirror/lang-json')).json()
    case 'xml': return (await import('@codemirror/lang-xml')).xml()
    case 'python': return (await import('@codemirror/lang-python')).python()
    case 'sql': return (await import('@codemirror/lang-sql')).sql()
    case 'markdown': return (await import('@codemirror/lang-markdown')).markdown()
    default: return []
  }
}

export interface EditorSession { state?: EditorState; language: Compartment; config: Compartment; listen: Compartment }

interface Props {
  value: string
  language?: Language
  onChange?: (value: string) => void
  label: string
  readOnly?: boolean
  onView?: (view: EditorView | null) => void
  onSelection?: (position: { line: number; column: number }) => void
  session?: EditorSession
  diagnostics?: boolean
}

export function createEditorSession(): EditorSession {
  return { language: new Compartment(), config: new Compartment(), listen: new Compartment() }
}

function cursorPosition(state: EditorState) {
  const position = state.selection.main.head
  const line = state.doc.lineAt(position)
  return { line: line.number, column: position - line.from + 1 }
}

export default function CodeEditor(props: Props) {
  const { value, language = 'text', readOnly = false, label, diagnostics, session } = props
  const container = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const fallback = useRef<EditorSession | null>(null)
  const current = useRef(props)
  current.current = props

  useEffect(() => {
    if (!container.current) return
    const cache = session ?? (fallback.current ??= createEditorSession())
    const listener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(Transaction.userEvent) === 'external')) current.current.onChange?.(update.state.doc.toString())
      if (update.selectionSet || update.docChanged) current.current.onSelection?.(cursorPosition(update.state))
    })
    const editor = new EditorView({
      parent: container.current,
      state: cache.state ?? EditorState.create({ doc: current.current.value, extensions: [basicSetup, theme, colors, EditorView.lineWrapping, cache.language.of([]), cache.config.of([]), cache.listen.of(listener)] }),
    })
    if (cache.state) editor.dispatch({ effects: cache.listen.reconfigure(listener) })
    view.current = editor
    current.current.onView?.(editor)
    current.current.onSelection?.(cursorPosition(editor.state))
    return () => {
      if (session) session.state = editor.state
      editor.destroy()
      view.current = null
      current.current.onView?.(null)
    }
  }, [session])

  useEffect(() => {
    const editor = view.current
    const cache = session ?? fallback.current
    if (!editor || !cache) return
    editor.dispatch({ effects: cache.config.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly), EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', tabindex: '0' })]) })
  }, [session, label, readOnly])

  useEffect(() => {
    const editor = view.current
    const cache = session ?? fallback.current
    if (!editor || !cache) return
    let active = true
    const runner = diagnostics && (language === 'lua' || language === 'luau') ? createRunner() : undefined
    const lint = linter(async (instance): Promise<Diagnostic[]> => {
      if (instance.state.doc.length > 80_000) return []
      if (runner) {
        const doc = instance.state.doc
        try { await runner.run({ id: 'lua-check', text: doc.toString(), option: language }); return [] }
        catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return []
          const message = error instanceof Error ? error.message : String(error)
          const lineNumber = Number(message.match(/(?:line\s+(\d+)|\b(\d+):\d+\b)/i)?.slice(1).find(Boolean) ?? 1)
          const line = doc.line(Math.min(doc.lines, Math.max(1, lineNumber)))
          return [{ from: line.from, to: line.to, severity: 'error', message }]
        }
      }
      const issues: Diagnostic[] = []
      syntaxTree(instance.state).iterate({ enter(node) {
        if (node.type.isError && issues.length < 50) issues.push({ from: node.from, to: node.to, severity: 'error', message: 'Revisa la sintaxis cerca de este punto.' })
      } })
      return issues
    }, { delay: 700 })
    extensions(language).then(extension => {
      if (active) editor.dispatch({ effects: cache.language.reconfigure([extension, diagnostics && ['lua', 'luau', 'javascript', 'typescript', 'json', 'css', 'html', 'xml', 'python'].includes(language) ? lint : []]) })
    }).catch(() => {
      if (active) editor.dispatch({ effects: cache.language.reconfigure([]) })
    })
    return () => { active = false; runner?.close() }
  }, [language, diagnostics, session])

  useEffect(() => {
    const editor = view.current
    if (!editor || editor.state.doc.toString() === value) return
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value }, annotations: [Transaction.userEvent.of('external'), Transaction.addToHistory.of(false)] })
  }, [value, session])

  return <div className="code-editor" ref={container} />
}
