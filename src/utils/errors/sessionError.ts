/**
 * A session-path failure carrying its code. The offline queue classifies by
 * code, so a bare `Error` here withdraws the queued write.
 */
export class SessionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}
