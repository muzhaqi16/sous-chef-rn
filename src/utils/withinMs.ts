/**
 * `promise`'s value, or `fallback` once `ms` pass first; rejects as `promise`
 * does. The timer is cleared either way, so a settled race holds no timer open.
 */
export function withinMs<T, F>(
  promise: Promise<T>,
  ms: number,
  fallback: F,
): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<F>(resolve => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, ceiling]).finally(() => clearTimeout(timer));
}
