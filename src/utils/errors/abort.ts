/**
 * A request aborted because the caller tore it down — not a failure.
 *
 * The common case is a query cancelled mid-flight when the user navigates away
 * before it settles: Apollo signals the abort, `fetch` rejects with an
 * `AbortError`, and reporting that as an error is pure noise. (It only became
 * reachable once `httpLink` started forwarding Apollo's cancellation signal
 * into the underlying fetch — before that the abort never happened, so nothing
 * ever threw.)
 *
 * Use at a catch site to skip reporting:
 *
 * ```ts
 * try {
 *   await refetch();
 * } catch (error) {
 *   if (isAbortError(error)) return;
 *   errorService.reportError(error, { operation: '…' });
 * }
 * ```
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
