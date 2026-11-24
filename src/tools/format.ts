import type { Language } from './catalog'

let styLuaReady: Promise<void> | undefined
let pythonReady: Promise<void> | undefined

export async function formatLua(source: string, language: 'lua' | 'luau', width = 2) {
  const styLua = await import('@johnnymorganz/stylua/web')
  const { default: wasm } = await import('@johnnymorganz/stylua/stylua_lib_bg.wasm?url')
  styLuaReady ??= styLua.default({ module_or_path: wasm }).then(() => undefined).catch(error => {
    styLuaReady = undefined
    throw error
  })
  await styLuaReady
  const config = styLua.Config.new()
  config.syntax = language === 'lua' ? styLua.LuaVersion.Lua54 : styLua.LuaVersion.Luau
  config.indent_type = styLua.IndentType.Spaces
  config.indent_width = width
  return styLua.formatCode(source, config, null, styLua.OutputVerification.Full)
}

export async function formatCode(source: string, language: Language, dialect = 'sql') {
  if (language === 'lua' || language === 'luau') return formatLua(source, language)
  if (language === 'sql') {
    const { format } = await import('sql-formatter')
    const selected = (['sql', 'postgresql', 'mysql', 'sqlite', 'transactsql', 'bigquery'] as const).find(name => name === dialect) ?? 'sql'
    return format(source, { language: selected, keywordCase: 'upper' })
  }
  if (language === 'python') {
    const ruff = await import('@wasm-fmt/ruff_fmt/vite')
    pythonReady ??= ruff.default().then(() => undefined).catch(error => {
      pythonReady = undefined
      throw error
    })
    await pythonReady
    return ruff.format(source)
  }
  const { format } = await import('prettier/standalone')
  const optional = { tabWidth: 2, endOfLine: 'lf' } as const
  switch (language) {
    case 'html': return format(source, { ...optional, parser: 'html', plugins: [await import('prettier/plugins/html')] })
    case 'css': return format(source, { ...optional, parser: 'css', plugins: [await import('prettier/plugins/postcss')] })
    case 'xml': return format(source, { ...optional, parser: 'xml', plugins: [(await import('@prettier/plugin-xml')).default], xmlWhitespaceSensitivity: 'strict' })
    case 'markdown': return format(source, { ...optional, parser: 'markdown', plugins: [await import('prettier/plugins/markdown')] })
    case 'json': JSON.parse(source); break
    case 'text': return source.replace(/\r\n?/g, '\n').trimEnd() + '\n'
  }
  const [estree, parser] = await Promise.all([import('prettier/plugins/estree'), language === 'typescript' ? import('prettier/plugins/typescript') : import('prettier/plugins/babel')])
  return format(source, { ...optional, parser: language === 'json' ? 'json' : language === 'typescript' ? 'typescript' : 'babel', plugins: [estree, parser] })
}
