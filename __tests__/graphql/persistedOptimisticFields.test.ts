/**
 * Every field persisted for optimistic restoration must exist on its type.
 *
 * `optimisticDataPersistence.save(...)` / `.track(...)` take an entity type and
 * a field name as plain strings, and restoration replays them through
 * `cache.modify({ id, fields: { [name]: … } })`. `cache.modify` **silently
 * ignores** a modifier for a field the entity does not have — no throw, no
 * warning, nothing in a log. So a wrong name is invisible at every stage:
 * typecheck passes (they're strings), lint passes, the unit tests pass (they
 * assert the value was persisted, not that it restored), and the feature just
 * quietly doesn't survive a restart.
 *
 * That is what happened to the shopping list's offline "purchased" tick. It was
 * persisted as `isPurchased`, but `ShoppingListItem` has no such field —
 * `isPurchased` lives inside `purchaseInfo`. The code carried a comment saying
 * the state "survives app restarts while offline"; it never did.
 *
 * This test parses the real schema and checks every persisted (type, field)
 * pair against it, so the next one fails here instead of in someone's pantry.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';
import { parse, Kind, type ObjectTypeDefinitionNode } from 'graphql';

const ROOT = resolve(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const SCHEMA = join(SRC, 'graphql', 'generated', 'schema.graphql');

/** Field names declared on each object type in the schema. */
const schemaFields = (): Map<string, Set<string>> => {
  const doc = parse(readFileSync(SCHEMA, 'utf8'));
  const byType = new Map<string, Set<string>>();
  for (const def of doc.definitions) {
    if (def.kind !== Kind.OBJECT_TYPE_DEFINITION) continue;
    const node = def as ObjectTypeDefinitionNode;
    byType.set(
      node.name.value,
      new Set((node.fields ?? []).map(f => f.name.value)),
    );
  }
  return byType;
};

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.generated.ts')) {
      out.push(full);
    }
  }
  return out;
};

interface PersistedField {
  file: string;
  entityType: string;
  field: string;
}

/**
 * Find `optimisticDataPersistence.save(…)` / `.track(…)` calls and read their
 * first two string arguments.
 *
 * Both take `(entityType, entityId, field, value)`. Matching the literal call
 * shape is deliberate: a variable entity type or field name would not be
 * checkable here, and would be a worse idea than the bug this guards — so the
 * assertion below also requires that every call site be in this literal form.
 */
const CALL = /optimisticDataPersistence\s*\.\s*(?:save|track)\s*\(([^;]*?)\)\s*;/gs;

const collectPersistedFields = (): {
  fields: PersistedField[];
  unparsed: string[];
} => {
  const fields: PersistedField[] = [];
  const unparsed: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(CALL)) {
      const args = match[1];
      // First two string literals are entityType and (usually) the id; the
      // third is the field. Ids are variables, so the literals we get back are
      // [entityType, field].
      const literals = [...args.matchAll(/'([^']*)'|"([^"]*)"/g)].map(
        m => m[1] ?? m[2],
      );
      const relPath = relative(ROOT, file);
      if (literals.length < 2) {
        unparsed.push(`${relPath}: ${args.replace(/\s+/g, ' ').trim()}`);
        continue;
      }
      fields.push({
        file: relPath,
        entityType: literals[0],
        field: literals[1],
      });
    }
  }

  return { fields, unparsed };
};

describe('persisted optimistic fields exist on their type', () => {
  const { fields, unparsed } = collectPersistedFields();
  const types = schemaFields();

  it('finds the persistence call sites at all', () => {
    // A regex that matched nothing would make every assertion below vacuous —
    // the exact failure mode these checks exist to close.
    expect(fields.length).toBeGreaterThan(0);
  });

  it('every call site names its entity type and field as string literals', () => {
    // A computed field name cannot be checked here, and `cache.modify` would go
    // on ignoring it silently. Keep them literal.
    expect(unparsed).toEqual([]);
  });

  it('every persisted field is a real field of its type', () => {
    const broken = fields
      .filter(({ entityType, field }) => {
        const known = types.get(entityType);
        // An unknown type is its own failure, reported by the next test.
        return known ? !known.has(field) : false;
      })
      .map(
        ({ file, entityType, field }) =>
          `${entityType}.${field} (${file}) — cache.modify will ignore this silently`,
      );

    expect(broken).toEqual([]);
  });

  it('every persisted entity type exists in the schema', () => {
    const unknown = fields
      .filter(({ entityType }) => !types.has(entityType))
      .map(({ file, entityType }) => `${entityType} (${file})`);

    expect(unknown).toEqual([]);
  });
});
