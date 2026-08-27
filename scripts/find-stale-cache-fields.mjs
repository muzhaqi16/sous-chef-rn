/**
 * Finds fields that a mutation can leave stale in the Apollo cache.
 *
 * Apollo normalizes by `__typename` + `id`, so a mutation's response is a
 * partial write over the cached entity: any field it does NOT select keeps its
 * previous value. That is fine for fields the mutation cannot change, and a bug
 * for fields the server recomputes as a side effect — counts, totals, rates,
 * "last…" timestamps. The screen reading those keeps painting the pre-mutation
 * value until something else refetches, which under `cache-and-network` looks
 * like an intermittent "it's empty until I reload".
 *
 * This is the static half: for every mutation, resolve what it selects on the
 * entity it returns (following fragment spreads, with types resolved from the
 * schema), compare against everything the app's QUERIES read on that type, and
 * report the difference — derived-looking names first.
 *
 * **This produces candidates, not defects, and cannot be driven to zero.**
 * Whether a mutation actually recomputes a given field is a property of the
 * server, and no static analysis can know it: `UpdateRecipeIngredients` returns
 * a Recipe without `averageRating`, but editing ingredients does not change a
 * rating, so that pair is noise. The two confirmed cases in this codebase
 * (`purchaseHistory` on toggle-purchased, `remainingNetWeight` on
 * update-quantity) were each settled by calling the API and diffing before and
 * after — that is the only way to be sure.
 *
 * `--check` therefore ratchets rather than demanding zero: it fails on a pair
 * that is NEW since the baseline, which is the signal worth acting on. A green
 * run means "no new gaps to triage", not "no stale fields exist".
 *
 * ## Verified against the dev API
 *
 * Each of these was settled by reading the entity, running the mutation, and
 * reading it again. Recorded so the next person triaging a flagged pair does
 * not repeat the measurement.
 *
 * | Operation                   | Server recomputes            | Verdict |
 * |-----------------------------|------------------------------|---------|
 * | ToggleShoppingListItemPurchased | purchaseHistory          | was missing — added |
 * | UpdatePantryItemQuantity    | quantity (rounded to 2dp)    | returned |
 * | OpenPantryItemBatch         | lastUsedAt, version          | lastUsedAt was missing — added |
 * | WastePantryItemBatch        | quantity, activeBatchCount   | both returned |
 * | AdjustPantryItemQuantity    | quantity, remainingNetWeight | both returned |
 *
 * Ruled out by the same method, despite being flagged: `remainingNetWeight` and
 * `activeBatchCount` on OpenPantryItemBatch (opening a batch consumes nothing),
 * and `totalCost` / `purchase` on AdjustPantryItemQuantity (unchanged across
 * the adjustment). Flagged pairs are candidates, not defects.
 *
 * Also learned, and not something this script can see: the server stores
 * quantities to two decimal places (1.236 -> 1.24), so the optimistic cache and
 * the server disagree past that precision regardless of which fields come back.
 *
 *   node scripts/find-stale-cache-fields.mjs [--all]
 */
import { readFileSync, existsSync } from 'node:fs';
import { relative } from 'node:path';
import {
  baselineFile,
  filesUnder,
  fromRoot,
  requireNonEmptyScan,
} from './lib/tooling.mjs';
import {
  parse,
  visit,
  buildSchema,
  TypeInfo,
  visitWithTypeInfo,
  getNamedType,
  isObjectType,
  isInterfaceType,
} from 'graphql';

const SCHEMA = fromRoot('src', 'graphql', 'generated', 'schema.graphql');
const BASELINE = baselineFile(
  fromRoot('scripts', 'find-stale-cache-fields.baseline.json'),
);
const SHOW_ALL = process.argv.includes('--all');
const CHECK = process.argv.includes('--check');
const UPDATE = process.argv.includes('--update');

// Resolving types from the schema rather than guessing is what lets nested
// selections count. The previous version passed `null` as the type for any
// field selected inline on a nested object, so those fields were invisible on
// both the query and the mutation side — the detector could not see a stale
// field unless it happened to arrive via a named fragment.
const schema = existsSync(SCHEMA)
  ? buildSchema(readFileSync(SCHEMA, 'utf8'))
  : null;
if (!schema) {
  console.error(
    `✗ No schema at ${SCHEMA}. Run \`npm run codegen\` first — without it this\n` +
      `  check can only see fragment-carried fields and would under-report.`,
  );
  process.exit(2);
}

/** Fields whose value is derived from other rows, so a write elsewhere moves
 *  them. These are the ones worth looking at first. */
const DERIVED =
  /count|total|sum|rate|average|avg|stats|summary|last[A-Z]|recent|remaining|completed|previously|has[A-Z]|is[A-Z].*ed$|progress|balance|score/i;

// --- collect documents -------------------------------------------------------
const files = filesUnder('src/**/*.graphql', {
  exclude: [/(^|\/)(generated|__tests__)(\/|$)/],
});
const fragments = new Map(); // name -> FragmentDefinition
const operations = []; // { kind, name, ast }

for (const file of files) {
  let doc;
  try {
    doc = parse(readFileSync(file, 'utf8'));
  } catch {
    continue; // a file that does not parse standalone is not our concern here
  }
  for (const def of doc.definitions) {
    if (def.kind === 'FragmentDefinition') fragments.set(def.name.value, def);
    else if (def.kind === 'OperationDefinition') {
      operations.push({
        kind: def.operation,
        name: def.name?.value ?? '(anonymous)',
        ast: def,
        file,
      });
    }
  }
}

/**
 * Walks a selection set, resolving fragment spreads, and records
 * `type -> Set(field)` using the enclosing fragment's type condition as the
 * type name. Inline field selections inherit the nearest known type.
 */
/**
 * Records `type -> Set(field)` for every field selected anywhere under `node`,
 * resolving the parent type from the schema at each level so nested selections
 * are attributed correctly. Fragment spreads are inlined first so a single
 * schema-aware walk sees the whole selection.
 */
function collect(definition, into) {
  const inlined = inlineSpreads(definition, new Set());
  const typeInfo = new TypeInfo(schema);
  visit(
    inlined,
    visitWithTypeInfo(typeInfo, {
      Field() {
        const parent = getNamedType(typeInfo.getParentType());
        const field = typeInfo.getFieldDef();
        if (!parent || !field) return;
        if (!isObjectType(parent) && !isInterfaceType(parent)) return;
        if (!into.has(parent.name)) into.set(parent.name, new Set());
        into.get(parent.name).add(field.name);
      },
    }),
  );
}

/** Replaces every FragmentSpread with the fragment's selections, so one
 *  schema-aware traversal covers the full shape. Guards against cycles. */
function inlineSpreads(node, seen) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(n => inlineSpreads(n, seen));
  if (!node.selectionSet) return node;
  const selections = [];
  for (const sel of node.selectionSet.selections) {
    if (sel.kind === 'FragmentSpread') {
      const name = sel.name.value;
      if (seen.has(name)) continue;
      const frag = fragments.get(name);
      if (!frag) continue;
      const nextSeen = new Set(seen).add(name);
      selections.push({
        kind: 'InlineFragment',
        typeCondition: frag.typeCondition,
        directives: [],
        selectionSet: inlineSpreads(frag, nextSeen).selectionSet,
      });
    } else {
      selections.push(inlineSpreads(sel, seen));
    }
  }
  return { ...node, selectionSet: { ...node.selectionSet, selections } };
}

// --- what QUERIES read, per type --------------------------------------------
const readByType = new Map();
for (const op of operations) {
  if (op.kind !== 'query') continue;
  const found = new Map();
  collect(op.ast, found);
  for (const [type, fields] of found) {
    if (!readByType.has(type)) readByType.set(type, new Set());
    for (const f of fields) readByType.get(type).add(f);
  }
}

/**
 * The entity a mutation actually mutates — the object directly under its
 * payload — rather than every type reachable in the selection.
 *
 * Without this the check blames a mutation for fields of entities that merely
 * appear nested in its response: a meal-plan mutation returning a nested recipe
 * was reported as leaving `Recipe.averageRating` stale, which it neither
 * changes nor is responsible for. That over-approximation is what took the
 * count to 137 and made the number unusable.
 */
function primaryEntityTypes(definition) {
  const inlined = inlineSpreads(definition, new Set());
  const typeInfo = new TypeInfo(schema);
  const types = new Set();
  // depth 1 = the mutation field, 2 = the entity it returns. `... on Payload`
  // is an inline fragment and does not count as a field, so the entity sits
  // directly under the mutation field. Anything deeper is a related entity the
  // mutation reports but does not own.
  let depth = 0;
  visit(
    inlined,
    visitWithTypeInfo(typeInfo, {
      Field: {
        enter() {
          depth += 1;
          if (depth !== 2) return;
          const named = getNamedType(typeInfo.getType());
          if (!named) return;
          if (!isObjectType(named) && !isInterfaceType(named)) return;
          // Entities only: something Apollo will normalize and therefore can
          // hold a stale value for.
          if (!('id' in named.getFields())) return;
          types.add(named.name);
        },
        leave() {
          depth -= 1;
        },
      },
    }),
  );
  return types;
}

// --- what each MUTATION writes back -----------------------------------------
const findings = [];
for (const op of operations) {
  if (op.kind !== 'mutation') continue;
  const written = new Map();
  collect(op.ast, written);
  const primary = primaryEntityTypes(op.ast);

  for (const [type, fields] of written) {
    if (!primary.has(type)) continue;
    const read = readByType.get(type);
    if (!read) continue;
    const missing = [...read].filter(f => !fields.has(f));
    const derived = missing.filter(f => DERIVED.test(f));
    if (derived.length || (SHOW_ALL && missing.length)) {
      findings.push({
        mutation: op.name,
        type,
        derived,
        missing,
        file: relative(fromRoot('src'), op.file),
      });
    }
  }
}

/**
 * Staleness needs a PRIOR cached value to go stale. A mutation that mints a new
 * entity writes a fresh record, so an unselected field is simply absent rather
 * than wrong — the next query fills it in. Only mutations acting on an entity
 * that is already in the cache can leave a wrong value on screen.
 */
const CREATES =
  /^(create|add.*to(Favorites|Pantry|ShoppingList)$|fork|duplicate|generate|import|copy)/i;
for (const f of findings) f.mutatesExisting = !CREATES.test(f.mutation);

findings.sort(
  (a, b) =>
    Number(b.mutatesExisting) - Number(a.mutatesExisting) ||
    b.derived.length - a.derived.length,
);

// A run that examined nothing must not read as clean — the same vacuity trap
// this whole change exists to close.
requireNonEmptyScan({
  count: operations.length,
  what: 'GraphQL operations',
  check: 'find-stale-cache-fields',
  hint: '`src/` moved, or the operations are no longer `.graphql` files.',
});

const risky = findings.filter(f => f.mutatesExisting);

if (CHECK || UPDATE) {
  const key = f => `${f.mutation}::${f.type}`;
  if (UPDATE) {
    BASELINE.write({
      maxRiskyPairs: risky.length,
      pairs: risky.map(key).sort(),
    });
    console.log(
      `Examined ${operations.length} operations. Baseline updated: ${risky.length} risky pairs.`,
    );
    process.exit(0);
  }
  const baseline = BASELINE.require('find-stale-cache-fields');
  const known = new Set(baseline.pairs);
  const added = risky.filter(f => !known.has(key(f)));
  console.log(
    `Examined ${operations.length} operations · ${risky.length} risky pairs ` +
      `(baseline ${baseline.maxRiskyPairs})`,
  );
  if (added.length) {
    console.error('\n✗ New mutation/field gaps since the baseline:');
    for (const f of added) {
      console.error(`  ${f.mutation} → ${f.type}\n    ${f.derived.join(', ')}`);
    }
    process.exit(1);
  }
  console.log('✓ No new gaps.');
  process.exit(0);
}

if (!findings.length) {
  console.log('No mutations leave a derived field unselected.');
  process.exit(0);
}

console.log(
  `${findings.length} mutation/type pair(s) return an entity without a field the app reads elsewhere.\n` +
    `Derived fields are listed first — those are the ones the server is most likely to recompute.\n`,
);
console.log(
  `${risky.length} of them mutate an entity that is already cached — only those can show a stale value.\n`,
);
for (const f of findings) {
  console.log(
    `${f.mutatesExisting ? '⚠ ' : '· '}${f.mutation}  →  ${f.type}${
      f.mutatesExisting
        ? ''
        : '   (creates a new entity — no prior value to go stale)'
    }`,
  );
  if (f.derived.length) console.log(`   derived : ${f.derived.join(', ')}`);
  if (SHOW_ALL && f.missing.length)
    console.log(
      `   other   : ${f.missing
        .filter(m => !f.derived.includes(m))
        .join(', ')}`,
    );
  console.log();
}
