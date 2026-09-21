/**
 * A caller's failure copy has to reach `localizedErrorMessage`, not be applied
 * to its result.
 *
 * The resolver is TOTAL — `fallback ?? t('errors.codes.unexpected')` with no
 * code, else `getUserFriendlyMessage(code, fallback)` — so it never returns a
 * falsy string and `localizedErrorMessage(err) || t('…')` is unreachable code.
 * Worse, the resolver conditions a behaviour on HAVING received a fallback:
 * `if (fallback && TRANSPORT_CODES.has(code)) return fallback`. Passing the
 * copy the wrong way disables it, so a WRITE that never left the device is
 * reported with the read-oriented offline sentence — "Showing cached data when
 * available" — which is not merely vague there but untrue.
 *
 * The behaviour half. The shape that produces it — `localizedErrorMessage(err)
 * || t(…)` — is `no-restricted-syntax`'s `callerFallbackAfterResolver`, since a
 * dead operand is a syntax question rather than a runtime one.
 */
import { localizedErrorMessage } from '#/services/errorService';

describe('localizedErrorMessage receives the caller’s copy', () => {
  it('prefers the caller’s copy over the read-oriented transport sentence', () => {
    const offline = { networkError: new Error('Network request failed') };

    const withFallback = localizedErrorMessage(offline, 'Could not save.');
    const withoutFallback = localizedErrorMessage(offline);

    // The escape hatch only fires when the fallback ARRIVES as the argument.
    expect(withFallback).toBe('Could not save.');
    expect(withoutFallback).not.toBe('Could not save.');
  });

  it('never returns an empty string, so `|| fallback` is unreachable', () => {
    for (const error of [
      undefined,
      new Error('boom'),
      { networkError: new Error('offline') },
      { graphQLErrors: [{ message: 'x', extensions: { code: 'FORBIDDEN' } }] },
    ]) {
      expect(localizedErrorMessage(error)).not.toBe('');
      expect(localizedErrorMessage(error, 'caller copy')).not.toBe('');
    }
  });
});
