import { useEffect, useState, type CSSProperties } from 'react'
import { Code2, Download, Palette, QrCode } from 'lucide-react'
import CodeEditor from '../editors/CodeEditor'
import { Button, CopyButton, Empty, SaveButton } from '../components/ui'
import { useStored } from '../hooks/useStored'
import type { Tool } from './catalog'

const positions = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']
const alignment = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline']
const defaults = { color: '#ae99ff', end: '#37245f', angle: 120, x: 10, y: 12, blur: 25, spread: 0, topLeft: 22, topRight: 22, bottomRight: 22, bottomLeft: 22, direction: 'row', justify: 'center', align: 'center', gap: 12, columns: 3, rows: 2, qr: '', correction: 'M' }
type Options = typeof defaults

function colorValues(hex: string) {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))
  const [red, green, blue] = rgb.map(channel => channel / 255)
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min
  const light = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1))
  const hue = delta === 0 ? 0 : max === red ? (green - blue) / delta : max === green ? 2 + (blue - red) / delta : 4 + (red - green) / delta
  return `HEX  ${hex.toUpperCase()}\nRGB  rgb(${rgb.join(', ')})\nHSL  hsl(${Math.round((hue * 60 + 360) % 360)}, ${Math.round(saturation * 100)}%, ${Math.round(light * 100)}%)`
}

export default function DesignTool({ tool }: { tool: Tool }) {
  const { value, update, status } = useStored(`tool:${tool.id}`, defaults)
  const [error, setError] = useState('')
  const [qr, setQr] = useState('')
  const patch = <Key extends keyof Options>(name: Key, input: Options[Key]) => update(previous => ({ ...previous, [name]: input }))
  const slider = (name: keyof Options & ('angle' | 'x' | 'y' | 'blur' | 'spread' | 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'gap' | 'columns' | 'rows'), label: string, min: number, max: number, unit = 'px') => <label className="slider-field" key={name}><span>{label}<output>{value[name]} {unit}</output></span><input type="range" min={min} max={max} value={value[name]} onChange={event => patch(name, Number(event.target.value))} /></label>
  const select = (name: 'direction' | 'justify' | 'align' | 'correction', label: string, options: string[]) => <label key={name}>{label}<select value={value[name]} onChange={event => patch(name, event.target.value)}>{options.map(item => <option key={item}>{item}</option>)}</select></label>
  const color = (name: 'color' | 'end', label: string) => <label className="color-field" key={name}>{label}<span><input type="color" value={value[name]} onChange={event => patch(name, event.target.value)} /><code>{value[name].toUpperCase()}</code></span></label>
  useEffect(() => {
    if (tool.id !== 'qr') return
    let active = true
    setQr(''); setError('')
    if (!value.qr.trim()) return
    const timer = window.setTimeout(() => {
      void import('qrcode').then(module => module.default.toDataURL(value.qr, { width: 360, margin: 2, errorCorrectionLevel: value.correction as 'L' | 'M' | 'Q' | 'H' })).then(url => { if (active) setQr(url) }, () => { if (active) setError('El texto es demasiado largo para el nivel de corrección seleccionado.') })
    }, 180)
    return () => { active = false; window.clearTimeout(timer) }
  }, [tool.id, value.qr, value.correction])

  let controls, code = '', style: CSSProperties = {}, layout = false, count = 4
  switch (tool.id) {
    case 'color': controls = color('color', 'Color'); style = { background: value.color }; code = colorValues(value.color); break
    case 'gradient': controls = <>{color('color', 'Inicio')}{color('end', 'Fin')}{slider('angle', 'Ángulo', 0, 360, '°')}</>; style = { background: `linear-gradient(${value.angle}deg, ${value.color}, ${value.end})` }; code = `background: ${style.background};`; break
    case 'shadow': controls = <>{color('color', 'Color de sombra')}{slider('x', 'Desplazamiento X', -40, 40)}{slider('y', 'Desplazamiento Y', -40, 40)}{slider('blur', 'Desenfoque', 0, 60)}{slider('spread', 'Extensión', -15, 25)}</>; style = { boxShadow: `${value.x}px ${value.y}px ${value.blur}px ${value.spread}px ${value.color}` }; code = `box-shadow: ${style.boxShadow};`; break
    case 'radius': controls = [slider('topLeft', 'Superior izquierda', 0, 100), slider('topRight', 'Superior derecha', 0, 100), slider('bottomRight', 'Inferior derecha', 0, 100), slider('bottomLeft', 'Inferior izquierda', 0, 100)]; style = { borderRadius: `${value.topLeft}px ${value.topRight}px ${value.bottomRight}px ${value.bottomLeft}px` }; code = `border-radius: ${style.borderRadius};`; break
    case 'flexbox': controls = [select('direction', 'Dirección', ['row', 'row-reverse', 'column', 'column-reverse']), select('justify', 'Alineación principal', positions), select('align', 'Alineación transversal', alignment), slider('gap', 'Separación', 0, 35)]; layout = true; style = { display: 'flex', flexDirection: value.direction as CSSProperties['flexDirection'], justifyContent: value.justify, alignItems: value.align, gap: `${value.gap}px` }; code = `display: flex;\nflex-direction: ${value.direction};\njustify-content: ${value.justify};\nalign-items: ${value.align};\ngap: ${value.gap}px;`; break
    case 'grid': controls = [slider('columns', 'Columnas', 1, 5, ''), slider('rows', 'Filas', 1, 4, ''), slider('gap', 'Separación', 0, 35)]; layout = true; count = value.columns * value.rows; style = { display: 'grid', gridTemplateColumns: `repeat(${value.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${value.rows}, minmax(0, 1fr))`, gap: `${value.gap}px` }; code = `display: grid;\ngrid-template-columns: ${style.gridTemplateColumns};\ngrid-template-rows: ${style.gridTemplateRows};\ngap: ${value.gap}px;`; break
    case 'qr': controls = <><label>Texto o URL<textarea value={value.qr} maxLength={3000} onChange={event => patch('qr', event.target.value)} placeholder="Introduce el contenido del código QR" /></label>{select('correction', 'Corrección de errores', ['L', 'M', 'Q', 'H'])}</>; break
  }

  return <>
    {status === 'error' && <p className="error" role="status">El navegador no pudo guardar los ajustes locales.</p>}
    <div className="tool-panels design-panels">
      <section className="panel"><div className="panel-bar"><Palette />Controles</div><div className="design-inputs">{controls}<Button onClick={() => update(defaults)}>Restablecer</Button></div></section>
      <section className="panel"><div className="panel-bar">Vista previa</div>{tool.id === 'qr' ? qr ? <div className="qr-preview"><img src={qr} alt="Código QR del texto introducido" width="260" height="260" /><a className="button" download="neb-qr.png" href={qr}><Download size={16} />Descargar PNG</a></div> : <Empty title="Introduce texto o una URL" detail="El código QR aparece aquí al escribir." icon={<QrCode />} /> : <div className="design-canvas">{layout ? <div className="layout-demo" style={style}>{Array.from({ length: count }, (_, index) => <div key={index}>{index + 1}</div>)}</div> : <div className="design-sample" style={style} />}</div>}</section>
      {code && <section className="panel full-width"><div className="panel-bar"><Code2 />{tool.id === 'color' ? 'Valores' : 'CSS generado'}</div><div className="short-editor"><CodeEditor value={code} label="Código generado" language={tool.id === 'color' ? 'text' : 'css'} readOnly /></div><div className="output-actions toolbar"><CopyButton value={code} onError={setError} /><SaveButton value={code} name={tool.id === 'color' ? 'colores.txt' : `${tool.id}.css`} /></div></section>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
  </>
}
