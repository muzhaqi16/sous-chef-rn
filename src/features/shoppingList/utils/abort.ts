/**
 * A request the caller tore down, not a failure — typically a query cancelled
 * when the user navigates away, since `httpLink` forwards Apollo's cancellation
 * into the underlying fetch. Use at a catch site to skip reporting.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
