import { readFileSync } from 'fs';
import { join } from 'path';
import { classifyError } from '../queueErrorPolicy';
import { SessionError } from '#/utils/errors/sessionError';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

/**
 * The queue decides withdraw-vs-park from the error's CODE. A bare `Error`
 * thrown on a path a queued replay traverses classifies `unknown` and DESTROYS
 * the local change. Device-verified: of three writes queued across one revoked
 * session, only the one whose failure carried a code survived.
 */
const SESSION_PATH_FILES = [
  'src/apollo/links/refreshToken.ts',
  'src/apollo/links/authLink.ts',
];

describe('errors on the session path carry a code', () => {
  // Any construction, not only `throw`: a bare `Error` handed to an operation
  // waiting on a shared refresh (`observer.error(new Error(…))`) destroys its
  // queued write exactly as a thrown one does.
  it.each(SESSION_PATH_FILES)('%s constructs no bare Error', file => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    const bare = src
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /\bnew Error\(/.test(line));

    // `Apollo client not registered` is a wiring assertion that cannot be
    // reached with a queued mutation in flight — the client is what starts one.
    const reachable = bare.filter(
      ({ line }) => !line.includes('Apollo client not registered'),
    );
    expect(reachable.map(({ line, n }) => `${file}:${n} ${line}`)).toEqual([]);
  });

  it.each([
    ErrorCode.AuthRefreshTokenSuperseded,
    ErrorCode.AuthRefreshTokenInvalid,
    TopLevelErrorCode.Unauthenticated,
  ])('%s classifies as auth, so the write parks', code => {
    const result = classifyError(
      new SessionError(code, 'session path failure'),
    );
    expect(result.type).toBe('auth');
    expect(result.retryable).toBe(true);
  });
});
