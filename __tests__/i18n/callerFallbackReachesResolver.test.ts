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
 * Two halves: the behaviour, and a scan that stops the shape coming back. The
 * shape type-checks and reads as correct, so nothing else can catch it.
 */
import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { readdirSync, statSync } from 'fs';
import { localizedErrorMessage } from '#/services/errorService';

const SRC = join(process.cwd(), 'src');

const collect = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') collect(full, found);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.generated.ts')
    ) {
      found.push(full);
    }
  }
  return found;
};

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

  it('is never called with its result short-circuited into a fallback', () => {
    // `localizedErrorMessage(err) || t('…')` and `?? t('…')`: the copy after the
    // operator can never be reached, and the resolver never saw it.
    const offenders: string[] = [];
    for (const file of collect(SRC)) {
      const code = readFileSync(file, 'utf8');
      if (!code.includes('localizedErrorMessage(')) continue;
      // Tolerates the line break prettier inserts before the operator.
      if (/localizedErrorMessage\([^;]*?\)\s*(\|\||\?\?)\s/u.test(code)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
