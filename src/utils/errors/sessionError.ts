/**
 * A failure on the session path — refresh, or a request cancelled because the
 * session is ending — carrying the code that classifies it.
 *
 * The offline queue decides withdraw-vs-park from the CODE
 * (`queueErrorPolicy.classifyError`), so a bare `Error` thrown here reads as an
 * unknown permanent failure and DESTROYS the queued write. Device-verified: of
 * three writes queued across one revoked session, only the one whose failure
 * carried a code survived.
 */
export class SessionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}
