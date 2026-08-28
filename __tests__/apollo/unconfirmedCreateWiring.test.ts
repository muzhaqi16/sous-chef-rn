import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * A local-first create that publishes a client-minted id must claim it, and the
 * detail screens keyed on that id must wait for the claim to clear.
 *
 * The create mints the row's permanent cuid and writes it into
 * `Pantry.itemsConnection` BEFORE firing — that is what makes the row appear
 * instantly and survive offline. But it also makes the row tappable, and both
 * pantry detail screens query the server by that id. Until the create lands the
 * server has no such row, so the read can only return `RESOURCE_NOT_FOUND`, and
 * `errorPolicy: 'all'` leaves the query parked in an error state that never
 * retries on its own.
 *
 * That shipped: production logged `GetPantryItem` and `GetPantryItemBatches`
 * failing back-to-back on a freshly created item, and the screen stayed broken
 * until the user navigated away and re-entered. `unconfirmedCreates` is the
 * repo's answer to exactly this and was wired for meal plans only.
 *
 * Both halves are load-bearing and fail differently:
 *   - a create that does not `mark` leaves the gate below permanently open, so
 *     the detail screen races the server and loses;
 *   - a create that marks but never `confirm`s strands the gate closed, so the
 *     screen never fetches at all.
 *
 * Derived from the tree rather than a hand-kept list, so a fourth pantry create
 * path cannot ship without the decision being made.
 */

const SRC = join(process.cwd(), 'src');

/** Mutations that create a PantryItem with a client-minted `input.id`. */
const CREATE_DOCUMENTS = [
  'CreatePantryItemDocument',
  'BarcodeCreatePantryItemDocument',
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

/** Writers that publish the client-minted row into a cached connection. */
const OPTIMISTIC_PUBLISHERS = [
  'addToPantryItemsCache(',
  'addToPantryItemsConnection(',
];

/**
 * The risk condition is not "creates a pantry item" — it is "publishes a
 * client-minted id into the cache before the server has the row". A plain
 * awaited create writes nothing until the payload lands, so no phantom id ever
 * becomes tappable and there is no window to gate. That is why onboarding's
 * `SelectPantryItems` is legitimately absent below rather than exempted by
 * name: add an optimistic write there and it joins this list automatically.
 *
 * `useMutation(` and the document name are matched across whitespace because
 * prettier splits the call when the options object is long.
 */
const creators = sources
  .filter(
    ({ code }) =>
      CREATE_DOCUMENTS.some(doc =>
        new RegExp(`useMutation\\(\\s*${doc}\\b`).test(code),
      ) && OPTIMISTIC_PUBLISHERS.some(writer => code.includes(writer)),
  )
  .map(({ path }) => path)
  .sort();

describe('unconfirmed-create wiring (pantry items)', () => {
  it('finds the create paths at all, so the checks below are not vacuous', () => {
    expect(creators.length).toBeGreaterThanOrEqual(3);
    expect(creators).toEqual(
      expect.arrayContaining([
        'src/features/barcode/components/SearchResults.tsx',
        'src/features/pantry/components/modals/AddToPantrySheet/AddToPantrySheet.tsx',
        'src/features/pantry/hooks/usePantryItemSubmission.ts',
      ]),
    );
  });

  it.each(creators)('%s claims and releases its client-minted id', file => {
    const code = stripComments(readFileSync(join(process.cwd(), file), 'utf8'));
    expect(code).toContain('unconfirmedCreates.mark(');
    expect(code).toContain('unconfirmedCreates.confirm(');
  });

  it.each(creators)(
    '%s reconciles a server-resolved id divergence',
    // The connection updaters dedupe BY ID, so a payload whose `pantryItem.id`
    // differs from `input.id` leaves the client cuid behind as a second,
    // permanently unresolvable edge — a row that 404s on every tap for the rest
    // of the session.
    file => {
      const code = stripComments(
        readFileSync(join(process.cwd(), file), 'utf8'),
      );
      expect(code).toContain('adoptServerEntityId(');
    },
  );

  // The other half of the contract: the screens that read by that id.
  it.each([
    'src/features/pantry/screens/PantryItemDetail.tsx',
    'src/features/pantry/components/form/PantryItemForm.tsx',
  ])('%s gates its pantry-item read on the create being acknowledged', file => {
    const code = stripComments(readFileSync(join(process.cwd(), file), 'utf8'));
    expect(code).toContain('useIsCreateUnconfirmed(');
    expect(code).toContain('isUnconfirmed');
  });
});
