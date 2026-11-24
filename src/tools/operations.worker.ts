import { runOperation } from './operations'
import type { Operation } from './operations'

self.onmessage = async (event: MessageEvent<{ key: number; input: Operation }>) => {
  const { key, input } = event.data
  try {
    const output = await runOperation(input)
    self.postMessage({ key, output }, { transfer: output.file ? [output.file.data] : [] })
  } catch (error) {
    self.postMessage({ key, error: error instanceof Error ? error.message : String(error) })
  }
}
