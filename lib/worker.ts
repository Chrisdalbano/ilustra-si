import { render } from './index.ts'
import type { RenderRequest, WorkerMessage } from './types.ts'

export interface RenderWorkerScope {
  onmessage: ((event: { data: RenderRequest }) => void) | null
  postMessage(message: WorkerMessage, transfer: ArrayBuffer[]): void
}

/** Injectable scope keeps the adapter testable without a DOM or worker runtime. */
export function installWorker(scope: RenderWorkerScope): void {
  scope.onmessage = ({ data }) => {
    let last = -Infinity
    try {
      const illustration = render(data, (phase, ratio, preview) => {
        const now = performance.now()
        if (ratio !== 1 && now - last < 50) return
        last = now
        // A transfer detaches its source: snapshot previews, never live algorithm buffers.
        const copy = preview?.map(stroke => ({ ...stroke, points: stroke.points.slice() }))
        scope.postMessage({ type: 'progress', phase, ratio, ...(copy ? { preview: copy } : {}) },
          copy?.map(stroke => stroke.points.buffer as ArrayBuffer) ?? [])
      })
      scope.postMessage({ type: 'done', illustration },
        [...new Set(illustration.strokes.map(stroke => stroke.points.buffer as ArrayBuffer))])
    } catch (error) {
      scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }, [])
    }
  }
}

const scope = globalThis as unknown as RenderWorkerScope
if (typeof scope.postMessage === 'function' && !('document' in globalThis)) installWorker(scope)
