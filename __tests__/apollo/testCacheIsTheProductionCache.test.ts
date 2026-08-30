/**
 * The cache a test gets by default is the cache the app ships.
 *
 * **The migration is done.** Every user of the helper now gets the production
 * cache; the last test in this file is what keeps it that way. The history
 * below is why the guard exists, not work outstanding.
 *
 * `apolloMockProvider` used to hand out a bare `InMemoryCache`. Production
 * builds `makeCache()` — 1014 lines: 16 `typePolicies` carrying 15 merge
 * functions, 6 read functions, 9 `merge: true` / `merge: false` directives, and
 * the generated `possibleTypes`. None of that loads in a bare instance, and a
 * rule that is not loaded cannot be tested — so 143 of the 154 files using the
 * helper ran an engine the app does not ship. The suite stayed green through
 * defects the policies would have caught, and through one case where it learned
 * the WRONG behaviour from the substitute.
 *
 * That case is the second test below. Without `possibleTypes`, an
 * `... on Error { code }` inline fragment does not match, Apollo drops `code`,
 * and the app falls back to generic copy — so a screen test asserted a generic
 * error message that a real user would never see, and asserted it successfully
 * for years.
 *
 * Both assertions are behavioural rather than structural: they check what the
 * cache DOES, so they survive a refactor of how `makeCache` is composed.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { gql, InMemoryCache } from '@apollo/client';
import { seedCache } from '#/test-utils/apolloMockProvider';

const ROW = gql`
  fragment PurchaseRow on ShoppingListItem {
    __typename
    id
    purchaseInfo {
      __typename
      isPurchased
      movedToPantryAt
    }
  }
`;

const ERROR_RESULT = gql`
  query ErrorProbe {
    probe {
      __typename
      ... on Error {
        code
        message
      }
    }
  }
`;

describe('the default test cache is the production cache', () => {
  it('runs a type policy the bare cache does not have', () => {
    // `ShoppingListItemPurchaseInfo.merge` clears the fields a write omits when
    // `isPurchased` changes. A bare cache has no merge function, so the write
    // simply replaces and nothing is cleared.
    const cache = seedCache([]);
    cache.writeFragment({
      id: 'ShoppingListItem:probe',
      fragment: ROW,
      data: {
        __typename: 'ShoppingListItem',
        id: 'probe',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: true,
          movedToPantryAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });

    cache.writeFragment({
      id: 'ShoppingListItem:probe',
      fragment: gql`
        fragment FlipOnly on ShoppingListItem {
          __typename
          id
          purchaseInfo {
            __typename
            isPurchased
          }
        }
      `,
      data: {
        __typename: 'ShoppingListItem',
        id: 'probe',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: false,
        },
      },
    });

    const stored = cache.extract()['ShoppingListItem:probe'] as {
      purchaseInfo?: Record<string, unknown>;
    };
    // Key PRESENCE, not `?? null`. A bare cache has no merge function, so the
    // second write REPLACES the record and `movedToPantryAt` is simply gone —
    // which `?? null` reports as null and cannot tell from the policy having
    // cleared it. That coercion is the same one that made a partial read look
    // whole in `writePantryItemDetailStub`; it makes a guard vacuous just as
    // easily as a writer.
    expect('movedToPantryAt' in (stored.purchaseInfo ?? {})).toBe(true);
    expect(stored.purchaseInfo?.movedToPantryAt).toBeNull();
  });

  it('matches an interface fragment, so a refusal keeps its code', () => {
    // The defect this file exists for. `possibleTypes` is what lets
    // `... on Error` match a `ForbiddenError`; without it Apollo cannot tell,
    // drops `code`, and every screen reading an error code sees nothing.
    const cache = seedCache([]);
    cache.writeQuery({
      query: ERROR_RESULT,
      data: {
        probe: {
          __typename: 'ForbiddenError',
          code: 'FORBIDDEN',
          message: 'nope',
        },
      },
    });

    const read = cache.readQuery<{
      probe: { code?: string } | null;
    }>({ query: ERROR_RESULT });

    expect(read?.probe?.code).toBe('FORBIDDEN');
  });

  it('a suite that wants a reduced cache still asks for one explicitly', () => {
    // The escape hatch is the `cache` parameter the helper already takes — a
    // caller passing its own instance keeps it. What changed is the DEFAULT,
    // not the ability to opt out.
    const bare = new InMemoryCache();
    expect(bare.extract()).toEqual({});
  });

  /**
   * ...but no HELPER USER may take it.
   *
   * Passing a bare instance into `renderWithApollo` reinstates the substitute
   * for that suite alone, while every other caller has moved off it — the
   * quietest possible regression, and one no assertion in the suite itself
   * would notice. A test that genuinely needs a reduced cache builds one
   * directly, without the helper, where the choice is visible.
   *
   * Enforced rather than left to convention because convention had already
   * failed: a hand-run sweep put this at zero, and this check found 19. The
   * default flip missed exactly these files — they passed their own instance
   * in, so they kept the substitute while every other suite moved off it.
   */
  it('no user of the shared helper passes its own bare cache', () => {
    const src = join(process.cwd(), 'src');
    const tests = join(process.cwd(), '__tests__');

    const collect = (dir: string, found: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full, found);
        else if (/\.test\.tsx?$/.test(entry)) found.push(full);
      }
      return found;
    };

    const offenders = [...collect(src), ...collect(tests)]
      .map(file => relative(process.cwd(), file))
      // This file constructs one deliberately, to show the hatch still works.
      .filter(file => !file.endsWith('testCacheIsTheProductionCache.test.ts'))
      .filter(file => {
        const code = readFileSync(join(process.cwd(), file), 'utf8');
        return (
          /renderWithApollo|renderHookWithApollo/.test(code) &&
          /new InMemoryCache\s*\(/.test(code)
        );
      });

    expect(offenders).toEqual([]);
  });
});
