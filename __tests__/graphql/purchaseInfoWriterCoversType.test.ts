/**
 * The one writer of `ShoppingListItem.purchaseInfo` must name every field the
 * type has.
 *
 * It writes the record through `cache.writeFragment`, and the record's type
 * policy CLEARS every field a write omits whenever `isPurchased` changes. The
 * writer therefore carries the cached record forward explicitly — so a field
 * added to the SDL but not to the writer is a field that a local flip silently
 * drops, with no error and nothing in the type system to catch it.
 *
 * Structural rather than behavioural on purpose: a behavioural test would have
 * to seed a value per field and so would grow the same blind spot it guards.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse, Kind } from 'graphql';

const ROOT = resolve(__dirname, '..', '..');

const TYPE_NAME = 'ShoppingListItemPurchaseInfo';
const WRITER = 'src/features/shoppingList/cache/purchase.ts';

/** Field names declared on the SDL type. */
function schemaFields(): string[] {
  const sdl = parse(
    readFileSync(resolve(ROOT, 'src/graphql/generated/schema.graphql'), 'utf8'),
  );
  for (const definition of sdl.definitions) {
    if (
      definition.kind === Kind.OBJECT_TYPE_DEFINITION &&
      definition.name.value === TYPE_NAME
    ) {
      return definition.fields?.map(field => field.name.value) ?? [];
    }
  }
  throw new Error(`${TYPE_NAME} not found in the SDL`);
}

/** Field names inside the writer's `PURCHASE_INFO_FIELDS` selection. */
function writerFields(): string[] {
  const source = readFileSync(resolve(ROOT, WRITER), 'utf8');
  const match = source.match(/const PURCHASE_INFO_FIELDS = `([\s\S]*?)`;/);
  if (!match) throw new Error(`PURCHASE_INFO_FIELDS not found in ${WRITER}`);

  // Field names are the first token on each line; a nested selection's own
  // sub-fields are indented further and are not fields OF this type.
  const [, block] = match;
  const names: string[] = [];
  let depth = 0;
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === '}') {
      depth -= 1;
      continue;
    }
    const name = line.replace(/\s*\{$/, '');
    if (depth === 0 && name !== '__typename') names.push(name);
    if (line.endsWith('{')) depth += 1;
  }
  return names;
}

describe('the purchaseInfo writer covers its SDL type', () => {
  it('names every field the schema declares', () => {
    const missing = schemaFields().filter(
      field => !writerFields().includes(field),
    );
    expect(missing).toEqual([]);
  });

  it('names no field the schema does not declare', () => {
    const known = schemaFields();
    const unknown = writerFields().filter(field => !known.includes(field));
    expect(unknown).toEqual([]);
  });
});
