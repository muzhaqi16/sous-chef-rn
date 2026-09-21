/**
 * Our own deadline expired before an operation settled. A class rather than a
 * message, so a caller classifies a timeout with `instanceof`.
 */
export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';

  constructor(message: string, readonly timeoutMs?: number) {
    super(message);
  }
}
