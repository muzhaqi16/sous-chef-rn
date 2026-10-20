// Read at call time, as properties of `globalThis`: a browser refuses an
// unbound `requestIdleCallback`, and tests install their own.
const host: {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
} = globalThis;

/**
 * Runs `callback` once the host is idle, or after a moment on a host with no
 * idle callbacks (Safari, node). Returns what cancels it.
 */
export function scheduleIdle(callback: () => void): () => void {
  if (host.requestIdleCallback) {
    const handle = host.requestIdleCallback(callback);
    return () => host.cancelIdleCallback?.(handle);
  }
  const timer = setTimeout(callback, 1);
  return () => clearTimeout(timer);
}
