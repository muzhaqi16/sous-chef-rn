/**
 * A `purchaseInfo` selection is complete, or it is the flag alone. Never part.
 *
 * `apollo/cache.ts` gives `ShoppingListItemPurchaseInfo` a merge that CLEARS
 * every field a write omits whenever that write changes `isPurchased`. That is
 * deliberate — the five fields describe one purchase, and inheriting the
 * previous purchase's amounts beside a new flag is how a collaborator's
 * re-purchase came to display someone else's name and price.
 *
 * It also makes a partial selection destructive rather than merely incomplete.
 * A document selecting `{ isPurchased purchasedPrice }` looks like it updates
 * the price; what it actually does is erase the quantity, the date and the
 * purchaser. Nothing in the type system or in codegen can see that, because
 * every one of those fields is nullable and the query is perfectly valid.
 *
 * So exactly two shapes are allowed:
 *
 *   - `...ShoppingListItemPurchaseInfoFragment` — the whole record. Used by
 *     every writer: the two purchase mutations, the offline-queue replay, and
 *     the subscription read-back.
 *   - `{ isPurchased }` alone — a reader that only needs the flag. The clear is
 *     correct there: all the response knows is that the state changed, and the
 *     detail screen is allowed to show nothing for a value it does not have.
 *
 * Anything between the two fails here, naming the document.
 *
 * `ItemDetail.graphql` is the one complete selection written out in full rather
 * than spread, because it is the reader and a named spread would mask the
 * fields from its direct reads under `dataMasking`. It passes by carrying the
 * whole set, which is the point — this test is what keeps it in step with the
 * fragment.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative, sep } from 'path';
import { parse, Kind, type SelectionSetNode } from 'graphql';

const ROOT = resolve(__dirname, '..', '..');
const SRC = resolve(ROOT, 'src');

/** The shared fragment's own name, and the record it defines. */
const SHARED_FRAGMENT = 'ShoppingListItemPurchaseInfoFragment';
const COMPLETE_RECORD = [
  'isPurchased',
  'purchasedQuantity',
  'purchasedPrice',
  'purchaseDate',
  'purchasedBy',
];

function collectGraphqlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    // Generated SDL/types are derived output, not authored operations.
    if (full.includes(`graphql${sep}generated`)) continue;
    const st = statSync(full);
    if (st.isDirectory()) collectGraphqlFiles(full, out);
    else if (full.endsWith('.graphql')) out.push(full);
  }
  return out;
}

const files = collectGraphqlFiles(SRC);

interface Offence {
  file: string;
  fields: string[];
}

/** The rule, on one selection's contents. Exported shape so it can be tested. */
function isAllowedShape(spreads: string[], fields: string[]): boolean {
  const isShared = spreads.includes(SHARED_FRAGMENT);
  const isFlagOnly = fields.length === 1 && fields[0] === 'isPurchased';
  const isCompleteInline = COMPLETE_RECORD.every(f => fields.includes(f));
  return isShared || isFlagOnly || isCompleteInline;
}

/** Every `purchaseInfo` selection in the tree, with what it selects. */
function findPurchaseInfoSelections(
  selectionSet: SelectionSetNode,
  file: string,
  out: Offence[],
): void {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      findPurchaseInfoSelections(selection.selectionSet, file, out);
      continue;
    }
    if (selection.kind !== Kind.FIELD || !selection.selectionSet) continue;

    if (selection.name.value === 'purchaseInfo') {
      const spreads = selection.selectionSet.selections
        .filter(s => s.kind === Kind.FRAGMENT_SPREAD)
        .map(s => (s as { name: { value: string } }).name.value);
      const fields = selection.selectionSet.selections
        .filter(s => s.kind === Kind.FIELD)
        .map(s => (s as { name: { value: string } }).name.value);

      if (!isAllowedShape(spreads, fields)) {
        out.push({ file, fields: [...spreads.map(s => `...${s}`), ...fields] });
      }
    }

    findPurchaseInfoSelections(selection.selectionSet, file, out);
  }
}

describe('purchaseInfo selections', () => {
  it('are complete or flag-only, never partial', () => {
    const offences: Offence[] = [];

    for (const file of files) {
      let doc;
      try {
        doc = parse(readFileSync(file, 'utf8'));
      } catch {
        continue;
      }
      for (const def of doc.definitions) {
        if (
          def.kind === Kind.OPERATION_DEFINITION ||
          def.kind === Kind.FRAGMENT_DEFINITION
        ) {
          findPurchaseInfoSelections(
            def.selectionSet,
            `${relative(ROOT, file)} (${def.name?.value ?? 'anonymous'})`,
            offences,
          );
        }
      }
    }

    expect(
      offences.map(o => `${o.file}: selects ${o.fields.join(', ')}`),
    ).toEqual([]);
  });

  it('the shared fragment defines the whole record', () => {
    const fragmentsFile = resolve(
      SRC,
      'features/shoppingList/graphql/shoppingListFragments.graphql',
    );
    const doc = parse(readFileSync(fragmentsFile, 'utf8'));
    const fragment = doc.definitions.find(
      d =>
        d.kind === Kind.FRAGMENT_DEFINITION && d.name.value === SHARED_FRAGMENT,
    );

    expect(fragment).toBeDefined();

    const fields = (fragment as { selectionSet: SelectionSetNode }).selectionSet.selections
      .filter(s => s.kind === Kind.FIELD)
      .map(s => (s as { name: { value: string } }).name.value);

    // Sorted so a field added to the fragment without being added to
    // COMPLETE_RECORD fails here rather than silently widening what counts as
    // "complete" for the inline reader above.
    expect([...fields].sort()).toEqual([...COMPLETE_RECORD].sort());
  });

  // Self-test. The scan above asserts that nothing in the repo is currently
  // partial — which is exactly what a scan that had silently stopped finding
  // anything would also report. These cases prove the classifier still refuses
  // what it is here to refuse, the way `check-bundled-secrets --self-test`
  // plants a secret to prove the scanner still finds one.
  describe('the rule itself', () => {
    it('refuses a partial selection', () => {
      expect(isAllowedShape([], ['isPurchased', 'purchasedPrice'])).toBe(false);
      expect(
        isAllowedShape([], ['isPurchased', 'purchasedQuantity', 'purchaseDate']),
      ).toBe(false);
      // Complete but for the purchaser — the shape that erases attribution.
      expect(
        isAllowedShape([], [
          'isPurchased',
          'purchasedQuantity',
          'purchasedPrice',
          'purchaseDate',
        ]),
      ).toBe(false);
    });

    it('allows the two shapes that are safe', () => {
      expect(isAllowedShape([SHARED_FRAGMENT], [])).toBe(true);
      expect(isAllowedShape([], ['isPurchased'])).toBe(true);
      expect(isAllowedShape([], COMPLETE_RECORD)).toBe(true);
    });

    it('does not mistake an unrelated fragment for the shared one', () => {
      expect(isAllowedShape(['SomeOtherFragment'], ['purchasedPrice'])).toBe(
        false,
      );
    });

    it('finds a planted partial in a real document', () => {
      const doc = parse(`
        fragment Planted on ShoppingListItem {
          id
          purchaseInfo { isPurchased purchasedPrice }
        }
      `);
      const found: Offence[] = [];
      for (const def of doc.definitions) {
        if (def.kind === Kind.FRAGMENT_DEFINITION) {
          findPurchaseInfoSelections(def.selectionSet, 'planted', found);
        }
      }
      expect(found).toHaveLength(1);
      expect(found[0].fields).toEqual(['isPurchased', 'purchasedPrice']);
    });
  });
});
