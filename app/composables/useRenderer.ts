import type { Illustration, RenderRequest, Stroke, WorkerMessage } from '../../lib/types'

interface Handlers {
  onPreview?: (strokes: Stroke[]) => void
  onDone: (illustration: Illustration) => void
}

/**
 * Runs renders in a Web Worker. The engine has no cooperative cancellation, so a
 * new request while one is still running terminates the worker and starts a fresh one.
 */
export function useRenderer() {
  const busy = ref(false)
  const phase = ref('')
  const ratio = ref(0)
  const error = ref('')
  let worker: Worker | null = null

  function spawn(): Worker {
    return new Worker(new URL('../../lib/worker.ts', import.meta.url), { type: 'module' })
  }

  /** Takes ownership of request.raster.values (its buffer is transferred). */
  function render(request: RenderRequest, handlers: Handlers) {
    if (busy.value && worker) {
      worker.terminate()
      worker = null
    }
    const w = worker ?? spawn()
    worker = w
    busy.value = true
    error.value = ''
    phase.value = 'Starting'
    ratio.value = 0
    w.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (w !== worker) return
      if (data.type === 'progress') {
        phase.value = data.phase
        ratio.value = data.ratio
        if (data.preview?.length) handlers.onPreview?.(data.preview)
      } else if (data.type === 'done') {
        busy.value = false
        ratio.value = 1
        handlers.onDone(data.illustration)
      } else {
        busy.value = false
        error.value = data.message
      }
    }
    w.onerror = (event) => {
      if (w !== worker) return
      event.preventDefault()
      busy.value = false
      error.value = event.message || 'The drawing worker stopped.'
      w.terminate()
      worker = null
    }
    w.postMessage(request, [request.raster.values.buffer as ArrayBuffer])
  }

  onBeforeUnmount(() => {
    worker?.terminate()
    worker = null
  })

  return { busy, phase, ratio, error, render }
}
