export type Category = 'lua' | 'dev' | 'web' | 'text' | 'files'
export type Language = 'lua' | 'luau' | 'html' | 'css' | 'javascript' | 'typescript' | 'json' | 'xml' | 'python' | 'sql' | 'markdown' | 'text'
type ToolKind = 'operation' | 'preview' | 'design' | 'file' | 'editor'

export interface Tool {
  id: string
  name: string
  description: string
  category: Category
  kind: ToolKind
  language?: Language
  output?: Language
  comparison?: boolean
  select?: readonly string[]
  inputless?: boolean
  example?: string
}

export const categories: { id: Category; label: string; short: string; description: string }[] = [
  { id: 'lua', label: 'Lua / Luau', short: 'Lua / Luau', description: 'Formato, sintaxis y análisis estático para tus scripts.' },
  { id: 'dev', label: 'Desarrollo', short: 'Desarrollo', description: 'Formateadores, codificadores y utilidades de programación.' },
  { id: 'web', label: 'Herramientas web', short: 'Web', description: 'Vistas previas y generadores para construir en la web.' },
  { id: 'text', label: 'Herramientas de texto', short: 'Texto', description: 'Limpia, transforma, compara y convierte texto.' },
  { id: 'files', label: 'Archivos', short: 'Archivos', description: 'Inspecciona, convierte y exporta archivos desde tu dispositivo.' },
]

function catalog(category: Category, list: [string, string, string, Partial<Tool>?][]): Tool[] {
  return list.map(([id, name, description, options]) => ({ id, name, description, category, kind: 'operation', ...options }))
}

const lua = { language: 'lua' } as const
const luau = { language: 'luau' } as const
const preview = { kind: 'preview' } as const
const design = { kind: 'design' } as const
const file = { kind: 'file' } as const
const codeLanguages = ['javascript', 'css', 'html', 'json', 'lua']
const formatLanguages = [...codeLanguages, 'typescript', 'luau', 'xml', 'python', 'sql', 'markdown']

export const tools = [
  ...catalog('lua', [
    ['lua-format', 'Lua Formatter', 'Aplica un estilo consistente al código Lua.', lua],
    ['luau-format', 'Luau Formatter', 'Formatea Luau, incluyendo anotaciones de tipos.', luau],
    ['lua-beautify', 'Lua Beautifier', 'Reindenta scripts Lua con cuatro espacios.', lua],
    ['lua-minify', 'Lua Minifier', 'Quita comentarios y espacios sin fusionar tokens Lua.', lua],
    ['lua-check', 'Syntax Checker', 'Comprueba la gramática de Lua o Luau sin ejecutar el script.', { ...lua, select: ['lua', 'luau'] }],
    ['lua-view', 'Lua Code Viewer', 'Abre un script con resaltado y numeración de líneas.', { ...lua, kind: 'editor' }],
    ['lua-editor', 'Lua Script Editor', 'Edita scripts Lua y Luau en el editor multipestaña.', { ...lua, kind: 'editor' }],
    ['lua-convert', 'Lua Code Converter', 'Prepara un script Lua común para Luau y valida el destino.', { ...lua, output: 'luau' }],
    ['lua-analyze', 'Lua Script Analyzer', 'Cuenta funciones, ámbitos y referencias globales en Lua 5.3.', lua],
    ['lua-diff', 'Lua Diff Checker', 'Compara dos versiones de un script línea por línea.', { ...lua, comparison: true }],
    ['lua-clean', 'Lua Code Cleaner', 'Retira el BOM invisible y normaliza la presentación del script.', lua],
    ['lua-comments', 'Lua Comment Remover', 'Retira comentarios sin modificar las cadenas de texto.', lua],
    ['lua-compress', 'Lua Code Compressor', 'Comprime y descarga el script como archivo .lua.gz.', lua],
    ['lua-highlight', 'Lua Syntax Highlighter', 'Visualiza tokens Lua con resaltado de sintaxis.', { ...lua, kind: 'editor' }],
  ]),
  ...catalog('dev', [
    ['html-format', 'HTML Formatter', 'Ordena etiquetas y atributos para leer el marcado.', { language: 'html' }],
    ['css-format', 'CSS Formatter', 'Da formato a reglas, selectores y declaraciones CSS.', { language: 'css' }],
    ['js-format', 'JavaScript Formatter', 'Formatea JavaScript o TypeScript con Prettier.', { language: 'javascript', select: ['javascript', 'typescript'] }],
    ['json-format', 'JSON Formatter', 'Valida e indenta objetos y arreglos JSON.', { language: 'json' }],
    ['json-validate', 'JSON Validator', 'Detecta errores de sintaxis JSON.', { language: 'json' }],
    ['xml-format', 'XML Formatter', 'Indenta documentos XML conservando el contenido de sus nodos.', { language: 'xml' }],
    ['base64-encode', 'Base64 Encoder', 'Codifica texto UTF-8 como Base64.', { example: 'Hola, NEB LUAU' }],
    ['base64-decode', 'Base64 Decoder', 'Decodifica Base64 y Base64 URL-safe a texto UTF-8.', { example: 'SG9sYSwgTkVCIExVQVU=' }],
    ['url-encode', 'URL Encoder', 'Codifica un componente de URL.', { example: 'Lua & Luau: edición' }],
    ['url-decode', 'URL Decoder', 'Decodifica caracteres escapados de una URL.', { example: 'Lua%20%26%20Luau' }],
    ['html-encode', 'HTML Encoder', 'Escapa caracteres especiales de HTML.', { example: '<strong>Hola</strong>' }],
    ['html-decode', 'HTML Decoder', 'Convierte entidades HTML a sus caracteres.', { example: 'Lua &amp; Luau' }],
    ['jwt-decode', 'JWT Decoder', 'Lee la cabecera y el contenido sin verificar la firma.'],
    ['hash', 'Hash Generator', 'Calcula un hash SHA del texto en tu navegador.', { select: ['SHA-256', 'SHA-384', 'SHA-512'], example: 'NEB LUAU' }],
    ['uuid', 'UUID Generator', 'Genera UUID v4 con el generador criptográfico del navegador.', { inputless: true }],
    ['regex', 'Regex Tester', 'Prueba un patrón, sus flags y grupos sobre un texto.', { example: 'Lua 5.4 y Luau' }],
    ['code-minify', 'Code Minifier', 'Reduce el tamaño del código sin ejecutarlo.', { select: codeLanguages }],
    ['code-beautify', 'Code Beautifier', 'Formatea código en varios lenguajes.', { select: formatLanguages }],
    ['diff', 'Diff Checker', 'Muestra líneas añadidas, eliminadas y sin cambios.', { comparison: true }],
    ['markdown', 'Markdown Preview', 'Visualiza Markdown en una vista aislada.', { ...preview, language: 'markdown' }],
    ['sql-format', 'SQL Formatter', 'Formatea consultas con el dialecto elegido.', { language: 'sql', select: ['sql', 'postgresql', 'mysql', 'sqlite', 'transactsql', 'bigquery'] }],
  ]),
  ...catalog('web', [
    ['html-playground', 'HTML Playground', 'Trabaja con HTML, CSS y JavaScript en un panel aislado.', { ...preview, language: 'html' }],
    ['css-playground', 'CSS Playground', 'Prueba estilos sobre tu propio marcado.', { ...preview, language: 'css' }],
    ['js-playground', 'JavaScript Playground', 'Ejecuta código de interfaz haciendo clic en Vista previa.', { ...preview, language: 'javascript' }],
    ['live-preview', 'Live Preview', 'Visualiza cambios de marcado y estilos mientras editas.', { ...preview, language: 'html' }],
    ['responsive', 'Responsive Preview', 'Enmarca el marcado a distintos anchos de pantalla.', { ...preview, language: 'html' }],
    ['html-view', 'HTML Viewer', 'Visualiza marcado HTML sin ejecutar scripts.', { ...preview, language: 'html' }],
    ['css-inspect', 'CSS Inspector', 'Consulta estilos calculados de un selector.', { ...preview, language: 'css' }],
    ['color', 'Color Picker', 'Elige un color y copia sus valores HEX, RGB y HSL.', design],
    ['gradient', 'Gradient Generator', 'Diseña un degradado lineal y copia su CSS.', design],
    ['shadow', 'Box Shadow Generator', 'Ajusta desplazamiento, desenfoque y extensión de la sombra.', design],
    ['radius', 'Border Radius Generator', 'Ajusta las cuatro esquinas de un elemento.', design],
    ['flexbox', 'Flexbox Generator', 'Prueba alineación, dirección y espacio entre elementos.', design],
    ['grid', 'Grid Generator', 'Configura filas y columnas y obtén su CSS.', design],
    ['svg-view', 'SVG Viewer', 'Visualiza código SVG como una imagen aislada.', { ...preview, language: 'xml' }],
    ['svg-optimize', 'SVG Optimizer', 'Reduce el tamaño del SVG con SVGO.', { language: 'xml', example: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><rect width="30" height="30" fill="#ff0000"/></svg>' }],
    ['qr', 'QR Generator', 'Genera un código QR en PNG a partir de texto o una URL.', design],
  ]),
  ...catalog('text', [
    ['words', 'Word Counter', 'Cuenta palabras, caracteres, líneas y párrafos.'],
    ['characters', 'Character Counter', 'Cuenta grafemas, puntos de código y bytes UTF-8.'],
    ['text-clean', 'Text Cleaner', 'Normaliza saltos de línea y retira espacios sobrantes.'],
    ['empty-lines', 'Remove Empty Lines', 'Elimina líneas vacías o que solo contienen espacios.'],
    ['duplicate-spaces', 'Remove Duplicate Spaces', 'Reduce secuencias de espacios y tabulaciones.'],
    ['uppercase', 'Uppercase Converter', 'Convierte texto a mayúsculas.'],
    ['lowercase', 'Lowercase Converter', 'Convierte texto a minúsculas.'],
    ['text-compare', 'Text Comparator', 'Identifica diferencias línea por línea en dos textos.', { comparison: true }],
    ['lorem', 'Lorem Ipsum Generator', 'Genera la cantidad de párrafos que necesitas.', { inputless: true }],
    ['slug', 'Slug Generator', 'Convierte un título en un identificador para URL.', { example: 'Guía de Lua y Luau' }],
    ['csv-json', 'CSV to JSON', 'Convierte filas con encabezados en objetos JSON.', { output: 'json', example: 'lenguaje,tipo\nLua,scripting\nLuau,tipado' }],
    ['json-csv', 'JSON to CSV', 'Convierte un arreglo plano de objetos en filas CSV.', { language: 'json', output: 'text', example: '[{"lenguaje":"Lua","tipo":"scripting"},{"lenguaje":"Luau","tipo":"tipado"}]' }],
  ]),
  ...catalog('files', [
    ['file-view', 'File Viewer', 'Previsualiza imágenes y archivos de texto locales.', file],
    ['json-view', 'JSON Viewer', 'Abre o pega JSON y explora su estructura.', { language: 'json', output: 'json' }],
    ['xml-view', 'XML Viewer', 'Importa o pega XML y explora el marcado formateado.', { language: 'xml', output: 'xml' }],
    ['csv-view', 'CSV Viewer', 'Abre CSV y examina sus registros en una tabla.', { example: 'lenguaje,tipo\nLua,scripting\nLuau,tipado' }],
    ['image-compress', 'Image Compressor', 'Crea una copia WebP o JPEG con calidad ajustable.', file],
    ['png-jpg', 'PNG to JPG', 'Convierte PNG a JPEG con fondo blanco.', file],
    ['jpg-png', 'JPG to PNG', 'Convierte JPEG a PNG.', file],
    ['image-webp', 'Image to WebP', 'Convierte una imagen rasterizada a WebP.', file],
    ['webp-png', 'WebP to PNG', 'Convierte WebP a PNG.', file],
    ['metadata', 'Metadata Viewer', 'Extrae metadatos EXIF, XMP e IPTC disponibles.', file],
    ['file-info', 'File Information', 'Consulta nombre, tamaño, tipo y última modificación.', file],
    ['file-drop', 'Drag and Drop Upload', 'Abre varios archivos locales sin enviarlos a un servidor.', file],
    ['file-export', 'File Exporter', 'Guarda una copia de un archivo con otro nombre.', file],
  ]),
]

export const samples: Partial<Record<Language, string>> = {
  lua: 'local function saludo(nombre)\n  return "Hola, " .. nombre\nend\n\nprint(saludo("NEB LUAU"))',
  luau: 'local function saludo(nombre: string): string\n  return `Hola, {nombre}`\nend\n\nprint(saludo("NEB LUAU"))',
  html: '<main>\n  <h1>Hola, NEB LUAU</h1>\n  <p>Edita este ejemplo para ver los cambios.</p>\n</main>',
  css: 'main {\n  font-family: system-ui, sans-serif;\n  padding: 2rem;\n  color: #24184a;\n}',
  javascript: 'const mensaje = "Hola, NEB LUAU";\nconsole.log(mensaje);',
  typescript: 'const mensaje:string = "Hola, NEB LUAU";\nconsole.log(mensaje);',
  json: '{"proyecto":"NEB LUAU","lenguajes":["Lua","Luau"]}',
  xml: '<?xml version="1.0"?>\n<proyecto nombre="NEB LUAU"><lenguaje>Lua</lenguaje></proyecto>',
  python: 'def saludo(nombre):\n    return f"Hola, {nombre}"\n\nprint(saludo("NEB LUAU"))',
  markdown: '# NEB LUAU\n\nEdita **Markdown** y observa el resultado.\n\n- Lua\n- Luau',
  sql: 'select nombre, lenguaje from proyectos where activo = true order by nombre;',
}

export function searchTools(query: string) {
  const normalize = (input: string) => input.toLowerCase().normalize('NFD').replace(/\p{Mark}/gu, '')
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  return tools.filter(tool => {
    const category = categories.find(item => item.id === tool.category)
    const haystack = normalize(`${tool.name} ${tool.description} ${category?.label} ${tool.id}`)
    return terms.every(term => haystack.includes(term))
  })
}
