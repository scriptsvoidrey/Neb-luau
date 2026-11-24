import type { Operation, Result } from '../tools/operations'

export function createRunner() {
  let worker: Worker | undefined
  let key = 0
  let cancelCurrent: (() => void) | undefined

  const run = (input: Operation, timeout = input.id === 'regex' ? 1200 : 20_000) => new Promise<Result>((resolve, reject) => {
    cancelCurrent?.()
    if (input.text.length + (input.second?.length ?? 0) > 4_194_304) { reject(new Error('La entrada supera el límite de 4 millones de caracteres.')); return }
    const target = worker ??= new Worker(new URL('../tools/operations.worker.ts', import.meta.url), { type: 'module' })
    const requestKey = ++key
    const cleanup = () => {
      target.removeEventListener('message', receive)
      target.removeEventListener('error', fail)
      window.clearTimeout(timer)
      cancelCurrent = undefined
    }
    const stop = (error: Error) => { cleanup(); target.terminate(); worker = undefined; reject(error) }
    const fail = () => stop(new Error('No se pudo iniciar la herramienta en este navegador.'))
    const receive = (event: MessageEvent<{ key: number; output?: Result; error?: string }>) => {
      if (event.data.key !== requestKey) return
      cleanup()
      if (event.data.output) resolve(event.data.output)
      else reject(new Error(event.data.error || 'No se pudo procesar la entrada.'))
    }
    const timer = window.setTimeout(() => stop(new Error('La operación tardó demasiado. Prueba con una entrada más pequeña o un patrón más simple.')), timeout)
    cancelCurrent = () => stop(new DOMException('Operación cancelada.', 'AbortError'))
    target.addEventListener('message', receive)
    target.addEventListener('error', fail)
    target.postMessage({ key: requestKey, input })
  })

  const close = () => { cancelCurrent?.(); worker?.terminate(); worker = undefined }
  return { run, close }
}
