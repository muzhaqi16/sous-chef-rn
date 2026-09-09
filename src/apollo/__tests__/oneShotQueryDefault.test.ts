import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { APOLLO_DEFAULT_OPTIONS } from '../defaultOptions';

/**
 * A one-shot `client.query()` reads the cache first, so it works offline unless
 * its caller says otherwise.
 *
 * `network-only` as the DEFAULT made every imperative read offline-hostile by
 * omission: a caller that named no policy could not answer from a warm cache,
 * which is the opposite of what the rest of the client is arranged to do. The
 * callers that genuinely need fresh data — device rows, credential lists, a
 * search whose whole point is the server's answer — say so, and this test keeps
 * that a decision rather than a default.
 */
const SRC = join(__dirname, '..', '..');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === '__mocks__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(generated|test)\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

/** Sites that deliberately go to the network, with why. */
const NETWORK_ONLY_CALLERS: Record<string, string> = {
  'features/notifications/hooks/useNotificationActionData.ts':
    'reseeds an expiration link the cache may hold stale',
  'features/notifications/hooks/useNotifications.ts':
    'reseeds the unread count from the server, which owns it',
  'features/recipes/utils/recipeSearchPaging.ts':
    'a search is the server answering, not the cache',
  'features/pantry/hooks/useHybridSearch.ts':
    'the server leg of a hybrid search; the local leg already answered',
  'services/authService.ts': 'device credentials must not be read stale',
  'services/subscriptions/fetchEventEntity.ts':
    'reads back the entity an event just named',
  'services/auth/deviceRegistration.ts':
    'device rows decide registration; a stale read re-registers',
};

describe('the one-shot query default', () => {
  it('is cache-first', () => {
    expect(APOLLO_DEFAULT_OPTIONS.query?.fetchPolicy).toBe('cache-first');
    expect(APOLLO_DEFAULT_OPTIONS.query?.errorPolicy).toBe('all');
  });

  it('is what a caller gets when it names no policy', () => {
    const unexplained: string[] = [];

    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!/\.query\(\{/.test(source)) continue;
      if (!/fetchPolicy:\s*'network-only'/.test(source)) continue;

      const relative = file.slice(SRC.length + 1);
      if (!NETWORK_ONLY_CALLERS[relative]) unexplained.push(relative);
    }

    expect(unexplained).toEqual([]);
  });

  it('keeps no note for a caller that stopped opting out', () => {
    const stale = Object.keys(NETWORK_ONLY_CALLERS).filter(relative => {
      const source = readFileSync(join(SRC, relative), 'utf8');
      return !/fetchPolicy:\s*'network-only'/.test(source);
    });

    expect(stale).toEqual([]);
  });
});
