import type { Language } from './catalog'
import { formatCode, formatLua } from './format'

export interface Operation {
  id: string
  text: string
  second?: string
  option?: string
  pattern?: string
  flags?: string
  count?: number
  language?: Language
}

export interface Result {
  text: string
  file?: { data: ArrayBuffer; name: string; type: string }
  changes?: { kind: 'added' | 'removed' | 'equal'; text: string }[]
  table?: string[][]
}

const utf8 = new TextEncoder()
const decodeUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const luaTools = ['lua-minify', 'lua-comments', 'lua-analyze']
const formatters = { 'html-format': 'html', 'css-format': 'css', 'json-format': 'json', 'json-view': 'json', 'xml-format': 'xml', 'xml-view': 'xml' } as const
const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'

function decodeBase64(input: string) {
  return decodeUtf8.decode(Uint8Array.from(atob(input.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')), char => char.charCodeAt(0)))
}

async function minify(text: string, language: string) {
  if (language === 'lua') return (await import('./lua')).minifyLua(text)
  if (language === 'json') {
    JSON.parse(text)
    return [...text.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[^\s"]/g)].map(match => match[0]).join('')
  }
  if (language === 'html') {
    const { minify } = await import('html-minifier-terser/dist/htmlminifier.esm.bundle')
    return minify(text, { collapseWhitespace: true, conservativeCollapse: true, removeComments: false })
  }
  if (language === 'css') return (await import('csso/dist/csso.esm')).minify(text).css
  const { minify } = await import('terser')
  return (await minify(text, { mangle: false, compress: false, format: { comments: 'some' } })).code ?? ''
}

export async function runOperation(input: Operation): Promise<Result> {
  const { id, text, second = '', option, language, pattern = '', flags = '' } = input
  const result = (value: string): Result => ({ text: value })
  if (Object.hasOwn(formatters, id)) return result(await formatCode(text, formatters[id as keyof typeof formatters]))
  if (luaTools.includes(id)) {
    const lua = await import('./lua')
    return result(id === 'lua-minify' ? lua.minifyLua(text) : id === 'lua-comments' ? lua.removeLuaComments(text) : lua.analyzeLua(text))
  }
  switch (id) {
    case 'format': return result(await formatCode(text, language ?? 'text'))
    case 'lua-format': case 'lua-beautify': return result(await formatLua(text, 'lua', id === 'lua-beautify' ? 4 : 2))
    case 'lua-clean': return result(await formatLua(text.replace(/^\uFEFF/, ''), 'lua'))
    case 'luau-format': return result(await formatLua(text, 'luau'))
    case 'lua-check': {
      const selected = option === 'luau' ? 'luau' : 'lua'
      await formatLua(text, selected)
      return result(`Sintaxis válida · ${selected === 'lua' ? 'Lua 5.4' : 'Luau'}\nEl código no se ejecutó. La verificación no evalúa tipos ni garantiza el comportamiento en tiempo de ejecución.`)
    }
    case 'lua-convert': {
      const formatted = await formatLua(text, 'lua')
      try { return result(await formatLua(formatted, 'luau')) }
      catch { throw new Error('Este script usa sintaxis que Luau no acepta. Revisa los operadores, etiquetas goto y atributos de Lua antes de convertirlo.') }
    }
    case 'lua-compress': {
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
      const data = await new Response(stream).arrayBuffer()
      return { text: `Original: ${utf8.encode(text).length} bytes\nGzip: ${data.byteLength} bytes\n\nDescarga el archivo para descomprimirlo con una herramienta compatible con gzip.`, file: { data, type: 'application/gzip', name: 'script.lua.gz' } }
    }
    case 'js-format': return result(await formatCode(text, option === 'typescript' ? 'typescript' : 'javascript'))
    case 'json-validate': JSON.parse(text); return result('JSON válido. La sintaxis cumple las reglas de JSON.')
    case 'code-beautify': return result(await formatCode(text, option as Language ?? 'javascript'))
    case 'code-minify': return result(await minify(text, option ?? 'javascript'))
    case 'sql-format': return result(await formatCode(text, 'sql', option))
    case 'base64-encode': return result(btoa(Array.from(utf8.encode(text), byte => String.fromCharCode(byte)).join('')))
    case 'base64-decode': {
      try { return result(decodeBase64(text)) }
      catch { throw new Error('Introduce Base64 válido que represente texto UTF-8.') }
    }
    case 'url-encode': return result(encodeURIComponent(text))
    case 'url-decode': {
      try { return result(decodeURIComponent(text)) }
      catch { throw new Error('La entrada contiene una secuencia de porcentaje no válida.') }
    }
    case 'html-encode': return result((await import('entities')).escape(text))
    case 'html-decode': return result((await import('entities')).decodeHTML(text))
    case 'jwt-decode': {
      const sections = text.trim().split('.')
      if (sections.length !== 3 || !sections[0] || !sections[1]) throw new Error('Se esperaba un JWT compacto de tres segmentos. No se admiten JWT cifrados.')
      const json = await Promise.all(sections.slice(0, 2).map(section => formatCode(decodeBase64(section), 'json')))
      return result(`Firma no verificada\n\nCABECERA\n${json[0]}\nCONTENIDO\n${json[1]}`)
    }
    case 'hash': {
      const digest = await crypto.subtle.digest(option ?? 'SHA-256', utf8.encode(text))
      return result(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''))
    }
    case 'uuid': return result(Array.from({ length: Math.min(100, Math.max(1, Math.floor(input.count ?? 1))) }, () => crypto.randomUUID()).join('\n'))
    case 'regex': {
      const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
      const matches = []
      for (const match of text.matchAll(re)) {
        matches.push(`${match.index}: ${JSON.stringify(match[0])}${match.length > 1 ? ` · grupos ${JSON.stringify(match.slice(1))}` : ''}${match.groups ? ` · nombres ${JSON.stringify(match.groups)}` : ''}`)
        if (matches.length >= 1000) break
      }
      return result(`${matches.length}${matches.length === 1000 ? '+' : ''} coincidencias\n\n${matches.join('\n')}`)
    }
    case 'lua-diff': case 'diff': case 'text-compare': {
      const { diffLines } = await import('diff')
      const diff = diffLines(text, second, { timeout: 1400, stripTrailingCr: true })
      if (!diff) throw new Error('La comparación es demasiado extensa. Prueba con fragmentos más pequeños.')
      const changes: NonNullable<Result['changes']> = diff.map(part => ({ kind: part.added ? 'added' : part.removed ? 'removed' : 'equal', text: part.value }))
      return { text: changes.map(change => change.text.replace(/\n$/, '').split('\n').map(line => `${change.kind === 'added' ? '+' : change.kind === 'removed' ? '-' : ' '} ${line}`).join('\n')).join('\n'), changes }
    }
    case 'svg-optimize': {
      const { optimize } = await import('svgo/browser')
      return result(optimize(text, { multipass: true }).data)
    }
    case 'words': case 'characters': {
      let graphemes = 0
      for (const part of new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(text)) if (part.segment) graphemes++
      if (id === 'characters') return result(`Grafemas: ${graphemes}\nPuntos de código: ${Array.from(text).length}\nBytes (UTF-8): ${utf8.encode(text).length}`)
      let words = 0
      for (const part of new Intl.Segmenter('es', { granularity: 'word' }).segment(text)) if (part.isWordLike) words++
      const trimmed = text.trim()
      return result(`Palabras: ${words}\nCaracteres: ${graphemes}\nLíneas: ${text ? text.split(/\r\n|\n|\r/).length : 0}\nPárrafos: ${trimmed ? trimmed.split(/(?:\r\n|\n|\r)\s*(?:\r\n|\n|\r)/).length : 0}`)
    }
    case 'text-clean': return result(text.replace(/\r\n?/g, '\n').replace(/[\t ]+$/gm, '').trim())
    case 'empty-lines': return result(text.split(/\r\n|\n|\r/).filter(line => line.trim()).join('\n'))
    case 'duplicate-spaces': return result(text.replace(/[\t ]{2,}/g, ' '))
    case 'uppercase': return result(text.toLocaleUpperCase('es'))
    case 'lowercase': return result(text.toLocaleLowerCase('es'))
    case 'lorem': return result(Array.from({ length: Math.min(50, Math.max(1, Math.floor(input.count ?? 1))) }, () => lorem).join('\n\n'))
    case 'slug': return result(text.toLocaleLowerCase('es').normalize('NFKD').replace(/\p{Mark}/gu, '').replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, ''))
    case 'csv-json': case 'csv-view': {
      const { default: papa } = await import('papaparse')
      if (id === 'csv-view') {
        const parsed = papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
        const error = parsed.errors.find(item => item.code !== 'UndetectableDelimiter')
        if (error) throw new Error(error.message)
        return { text, table: parsed.data.slice(0, 501) }
      }
      const parsed = papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy' })
      const error = parsed.errors.find(item => item.code !== 'UndetectableDelimiter')
      if (error) throw new Error(error.message)
      if (parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) throw new Error('Los encabezados CSV deben ser únicos.')
      return result(JSON.stringify(parsed.data, null, 2))
    }
    case 'json-csv': {
      const { default: papa } = await import('papaparse')
      const data: unknown = JSON.parse(text)
      if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object' || Array.isArray(item) || Object.values(item).some(value => value !== null && typeof value === 'object'))) {
        throw new Error('Introduce un arreglo de objetos planos con valores de texto, número, booleano o nulo.')
      }
      const fields = [...new Set(data.flatMap(row => Object.keys(row)))];
      return result(papa.unparse({ fields, data: data.map(row => fields.map(field => Object.hasOwn(row, field) ? row[field] : '')) }, { escapeFormulae: true }))
    }
    default: throw new Error('Herramienta no reconocida.')
  }
}
