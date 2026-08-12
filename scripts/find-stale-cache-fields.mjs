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
 * This is the static half: for every mutation, resolve what it selects on each
 * entity type (following fragment spreads), compare against everything the
 * app's QUERIES read on that same type, and report the difference — ranked so
 * the derived-looking fields come first. Candidates still need confirming
 * against the API, because plenty of unselected fields simply never change.
 *
 *   node scripts/find-stale-cache-fields.mjs [--all]
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { parse, visit } from 'graphql';

const SRC = 'src';
const SHOW_ALL = process.argv.includes('--all');

/** Fields whose value is derived from other rows, so a write elsewhere moves
 *  them. These are the ones worth looking at first. */
const DERIVED =
  /count|total|sum|rate|average|avg|stats|summary|last[A-Z]|recent|remaining|completed|previously|has[A-Z]|is[A-Z].*ed$|progress|balance|score/i;

function graphqlFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'generated' || entry === '__tests__') continue;
      graphqlFiles(full, out);
    } else if (extname(entry) === '.graphql') {
      out.push(full);
    }
  }
  return out;
}

// --- collect documents -------------------------------------------------------
const files = graphqlFiles(SRC);
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
function collect(node, typeName, into, seen = new Set()) {
  if (!node.selectionSet) return;
  for (const sel of node.selectionSet.selections) {
    if (sel.kind === 'Field') {
      if (typeName) {
        if (!into.has(typeName)) into.set(typeName, new Set());
        into.get(typeName).add(sel.name.value);
      }
      // Nested objects belong to a type we cannot resolve without the schema;
      // recurse with no type so their fragment spreads are still followed.
      collect(sel, null, into, seen);
    } else if (sel.kind === 'InlineFragment') {
      collect(sel, sel.typeCondition?.name.value ?? typeName, into, seen);
    } else if (sel.kind === 'FragmentSpread') {
      const name = sel.name.value;
      if (seen.has(name)) continue;
      seen.add(name);
      const frag = fragments.get(name);
      if (frag) collect(frag, frag.typeCondition.name.value, into, seen);
    }
  }
}

// --- what QUERIES read, per type --------------------------------------------
const readByType = new Map();
for (const op of operations) {
  if (op.kind !== 'query') continue;
  const found = new Map();
  collect(op.ast, null, found);
  for (const [type, fields] of found) {
    if (!readByType.has(type)) readByType.set(type, new Set());
    for (const f of fields) readByType.get(type).add(f);
  }
}

// --- what each MUTATION writes back -----------------------------------------
const findings = [];
for (const op of operations) {
  if (op.kind !== 'mutation') continue;
  const written = new Map();
  collect(op.ast, null, written);

  for (const [type, fields] of written) {
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
        file: op.file.replace(`${SRC}/`, ''),
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

if (!findings.length) {
  console.log('No mutations leave a derived field unselected.');
  process.exit(0);
}

console.log(
  `${findings.length} mutation/type pair(s) return an entity without a field the app reads elsewhere.\n` +
    `Derived fields are listed first — those are the ones the server is most likely to recompute.\n`,
);
const risky = findings.filter(f => f.mutatesExisting);
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
