import { parse } from 'luaparse'
import type { Chunk, Comment, Identifier, Node } from 'luaparse'

type ParsedChunk = Chunk & { globals?: Identifier[]; comments?: (Comment & { range?: [number, number] })[] }

const options = { luaVersion: '5.3', ranges: true, encodingMode: 'none' } as const
const eof = 1

function getTokens(source: string) {
  const parser = parse(source, { ...options, wait: true })
  const tokens: string[] = []
  for (let token = parser.lex(); token.type !== eof; token = parser.lex()) {
    tokens.push(source.slice(...token.range))
  }
  return tokens
}

function splitShebang(source: string) {
  const match = source.match(/^#![^\r\n]*(?:\r\n|\r|\n|$)/)
  return { header: match?.[0] ?? '', body: source.slice(match?.[0].length ?? 0) }
}

export function minifyLua(source: string) {
  const { header, body } = splitShebang(source)
  parse(body, options)
  const tokens = getTokens(body)
  const compressed = tokens.map((token, index) => {
    const previous = tokens[index - 1]?.at(-1) ?? ''
    const start = token[0] ?? ''
    const needsSpace = /[\w]/.test(previous) && /[\w]/.test(start) ||
      /[\d.]/.test(previous) && /[\d.]/.test(start) ||
      previous === '-' && start === '-' || previous === '[' && '[='.includes(start) ||
      /[<>=~:/]/.test(previous) && /[<>=~:/]/.test(start)
    return `${needsSpace ? ' ' : ''}${token}`
  }).join('')
  try {
    const result = getTokens(compressed)
    if (result.length === tokens.length && result.every((token, index) => token === tokens[index])) return header + compressed
  } catch {
    return header + tokens.join(' ')
  }
  return header + tokens.join(' ')
}

export function removeLuaComments(source: string) {
  const { header, body } = splitShebang(source)
  const ast = parse(body, { ...options, comments: true }) as ParsedChunk
  let offset = 0
  const parts = [header]
  for (const comment of ast.comments ?? []) {
    if (!comment.range) continue
    const [start, end] = comment.range
    parts.push(body.slice(offset, start), ' ', body.slice(start, end).replace(/[^\r\n]/g, ''))
    offset = end
  }
  parts.push(body.slice(offset))
  return parts.join('')
}

export function analyzeLua(source: string) {
  let functions = 0
  let scopes = 0
  let locals = 0
  const ast = parse(source, {
    ...options, comments: true, scope: true,
    onCreateScope: () => { scopes++ },
    onLocalDeclaration: () => { locals++ },
    onCreateNode: (node: Node) => { if (node.type === 'FunctionDeclaration') functions++ },
  }) as ParsedChunk
  const globalNames = [...new Set((ast.globals ?? []).map(entry => entry.name))].sort()
  return `Análisis estático · Lua 5.3\n\nLíneas: ${source.split(/\r\n|\n|\r/).length}\nFunciones: ${functions}\nÁmbitos léxicos: ${scopes}\nDeclaraciones locales: ${locals}\nComentarios: ${ast.comments?.length ?? 0}\nIdentificadores globales: ${globalNames.join(', ') || 'ninguno'}\n\nNo se ejecutó el script. Un resultado válido no garantiza compatibilidad con tu entorno.`
}
