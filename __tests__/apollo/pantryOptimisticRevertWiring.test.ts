import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Publishing a pantry row locally and withdrawing it again are one operation,
 * and the withdrawal is the half that gets forgotten.
 *
 * `addPantryItemLocally` moves TWO counters: the connection's `totalCount` and
 * `Pantry.stats.totalItems`. Only the first self-heals — the field policy drops
 * a dangling edge on read and subtracts it — so a revert that merely evicts the
 * entity leaves `stats.totalItems` one too high. The header's "N items" and the
 * "All" tab badge both read it, and `usePantryScreen` picks server- against
 * client-side sorting from it, so a stale one shows a wrong number AND can pick
 * the wrong mode. It survives until a pull-to-refresh.
 *
 * That is not hypothetical: the server refuses a duplicate add rather than
 * merging, so every add of an item already in the pantry takes this path. Two
 * such adds on a 70-item pantry read as 72.
 *
 * `revertOptimisticPantryItem` is the enforced mirror. Derived from the tree
 * rather than a hand-kept list, so a fourth pantry create path cannot ship
 * withdrawing a row without uncounting it.
 */

const SRC = join(process.cwd(), 'src');

/** Mutations that create a PantryItem with a client-minted `input.id`. */
const CREATE_DOCUMENTS = [
  'CreatePantryItemDocument',
  'BarcodeCreatePantryItemDocument',
];

/** Writers that publish the client-minted row into a cached connection. */
const OPTIMISTIC_PUBLISHERS = [
  'addToPantryItemsCache(',
  'addToPantryItemsConnection(',
  'addPantryItemLocally(',
];

const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');

const collectSourceFiles = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') collectSourceFiles(full, found);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.generated.ts')
    ) {
      found.push(full);
    }
  }
  return found;
};

const sources = collectSourceFiles(SRC).map(file => ({
  path: relative(process.cwd(), file),
  code: stripComments(readFileSync(file, 'utf8')),
}));

const creators = sources
  .filter(
    ({ code }) =>
      CREATE_DOCUMENTS.some(doc =>
        new RegExp(`useMutation\\(\\s*${doc}\\b`).test(code),
      ) && OPTIMISTIC_PUBLISHERS.some(writer => code.includes(writer)),
  )
  .map(({ path }) => path)
  .sort();

/**
 * A bare entity evict as the withdrawal. Matched across whitespace because
 * prettier splits the call when the cache expression is long.
 */
const BARE_EVICT = /safeEvict\(\s*[^,]+,\s*'PantryItem'/;

describe('optimistic pantry-item revert wiring', () => {
  it('finds the create paths at all, so the checks below are not vacuous', () => {
    expect(creators.length).toBeGreaterThanOrEqual(3);
    expect(creators).toEqual(
      expect.arrayContaining([
        'src/features/barcode/hooks/useAddScannedItem.ts',
        'src/features/pantry/hooks/mutations/useAddToPantry.ts',
        'src/features/pantry/hooks/usePantryItemSubmission.ts',
      ]),
    );
  });

  it.each(creators)('%s withdraws through the counting mirror', file => {
    const code = stripComments(readFileSync(join(process.cwd(), file), 'utf8'));
    expect(code).toContain('revertOptimisticPantryItem(');
  });

  it.each(creators)(
    '%s never withdraws a row by evicting the entity alone',
    file => {
      const code = stripComments(
        readFileSync(join(process.cwd(), file), 'utf8'),
      );
      expect(code).not.toMatch(BARE_EVICT);
    },
  );
});
