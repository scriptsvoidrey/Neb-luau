import { useCallback, useEffect, useRef, useState } from 'react'
import { load, save } from '../lib/workspace'

export function useStored<T>(key: string, initial: T, persistent = true) {
  const [value, setValue] = useState(initial)
  const [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading')
  const latest = useRef(value)
  const generation = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const persist = useCallback(() => {
    if (!persistent) return
    window.clearTimeout(timer.current)
    timer.current = undefined
    const current = generation.current
    void save(key, latest.current).then(() => {
      if (current === generation.current) setStatus('saved')
    }, () => {
      if (current === generation.current) setStatus('error')
    })
  }, [key, persistent])

  useEffect(() => {
    if (!persistent) { setStatus('saved'); return }
    let current = true
    void load<T>(key).then(stored => {
      if (!current || generation.current > 0) return
      if (stored !== undefined) { latest.current = stored; setValue(stored) }
      setStatus('saved')
    }, () => { if (current) setStatus('error') })
    const flush = () => { if (timer.current !== undefined) persist() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      current = false
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
      flush()
    }
  }, [key, persist, persistent])

  const update = useCallback((action: T | ((previous: T) => T)) => {
    const next = typeof action === 'function' ? (action as (previous: T) => T)(latest.current) : action
    if (next === latest.current) return
    latest.current = next
    generation.current++
    setValue(next)
    if (!persistent) return
    setStatus('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(persist, 180)
  }, [persist, persistent])
  return { value, update, status, persist }
}
