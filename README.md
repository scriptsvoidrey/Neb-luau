# NEB LUAU

Espacio de trabajo de desarrollo con 76 herramientas para Lua/Luau, programación, web, texto y archivos. La aplicación funciona sin cuentas ni backend: el procesamiento y el guardado se realizan en el navegador.

## Ejecutar en local

Requisitos: Node.js 22.12 o posterior y npm. Ejecuta `npm ci` y `npm run dev`. `npm run typecheck` verifica TypeScript. `npm run build` genera el sitio estático en `dist`.

## Publicar

| Plataforma | Configuración |
| --- | --- |
| Netlify | Conecta el repositorio. `netlify.toml` configura `npm run build` y `dist`. |
| Vercel | Importa el repositorio como proyecto Vite. `vercel.json` define el comando y la salida. |
| Cloudflare Pages | Conecta el repositorio, elige Vite o configura `npm run build` como comando y `dist` como directorio de salida. Usa Node.js 22 o posterior. |

No requiere variables de entorno. La navegación usa rutas con fragmentos (`#/editor`, `#/herramienta/lua-format`), por lo que los enlaces directos no dependen de redirecciones del servidor.

## Alcance y datos

- El editor usa CodeMirror y formateadores específicos por lenguaje. StyLua verifica sintaxis Lua 5.4 y Luau; el minificador, el analizador y el eliminador de comentarios analizan Lua 5.3. El conversor valida el subconjunto compatible con Luau y rechaza sintaxis incompatible en lugar de inventar una traducción.
- La verificación es estática; no ejecuta scripts Lua/Luau, no comprueba tipos de Luau y no garantiza resultados en Roblox u otros entornos. Studio Live inspiró el editor y el análisis; no se replica el alojamiento de scripts, la verificación remota de enlaces ni la cuenta de KRIPH.
- Los proyectos, pestañas abiertas y borradores se guardan en IndexedDB por origen y navegador. El historial local conserva hasta 20 revisiones por proyecto, limitado por tamaño. La exportación `.neb.json` contiene la estructura y los archivos de texto de la revisión actual; no incluye el historial. Exporta antes de limpiar los datos del navegador o cambiar de dispositivo, de dominio o de plataforma.
- Las vistas previas renderizan en un iframe aislado. JavaScript solo se ejecuta al solicitarlo en los playgrounds correspondientes; ejecuta únicamente código de confianza. El decodificador JWT no verifica firmas ni guarda tokens.
- La conversión de imágenes depende de los formatos admitidos por el navegador. Exporta una imagen estática y no conserva metadatos ni animaciones. Los archivos binarios se procesan en las herramientas de archivos, no en el editor de proyectos.
