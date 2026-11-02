import type { ErrorDisposition } from '#/graphql/generated/schemaTypes';

/**
 * A session-path failure carrying its code, and its disposition where the code
 * is not an auth refusal: no server answered, so nothing else states one. The
 * offline queue classifies these, so a bare `Error` here withdraws the write.
 */
export class SessionError extends Error {
  readonly code: string;
  readonly disposition: ErrorDisposition | undefined;

  constructor(code: string, message: string, disposition?: ErrorDisposition) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
    this.disposition = disposition;
  }
}
