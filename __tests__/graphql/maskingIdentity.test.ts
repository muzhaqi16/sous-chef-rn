/**
 * Guard against the data-masking identity bug.
 *
 * The app runs Apollo Client with `dataMasking: true` (see `codegen.ts` /
 * `src/apollo/client.ts`). Under masking, a NAMED fragment spread (`...Frag`)
 * is hidden from the parent selection — the parent only sees the fields it
 * selects DIRECTLY plus `__typename`. So a field written as:
 *
 *     shoppingListItem(id: $id) { ...ItemDetail_shoppingListItem }
 *
 * yields a masked object of just `{ __typename: 'ShoppingListItem' }` — its
 * `id` lives inside the (masked) fragment. The moment that masked object is
 * passed to `useFragment` / `cache.readFragment` / `cache.identify` (or any
 * code reads `.id` off it), key-field extraction throws:
 *
 *     Invariant Violation: Missing field 'id' while extracting keyFields…
 *     Could not identify object passed to `from` … please ensure the key
 *     fields are requested by the parent object.
 *
 * The fix — and the rule this test enforces — is: whenever a selection set
 * spreads a fragment that identifies its type (the fragment selects `id`),
 * that selection set must ALSO select `id` directly, so the key field survives
 * masking. This is Apollo's documented "always request id where available"
 * guidance applied to masked operations.
 *
 * Adding `id` is free: it's already fetched inside the spread fragment, so
 * there's no extra network cost — it only makes the key field visible on the
 * masked parent.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative, sep } from 'path';
import {
  parse,
  Kind,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

const SRC = resolve(__dirname, '..', '..', 'src');

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

// Global fragment registry (fragments are colocated across many files).
const fragDefs = new Map<string, FragmentDefinitionNode>();
for (const file of files) {
  let doc;
  try {
    doc = parse(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  for (const def of doc.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) fragDefs.set(def.name.value, def);
  }
}

const directlySelectsId = (sel: SelectionSetNode | undefined): boolean =>
  !!sel &&
  sel.selections.some(s => s.kind === Kind.FIELD && s.name.value === 'id');

// A fragment "identifies its type" when it selects `id` at its top level —
// directly, via a nested spread, or via an inline fragment. Memoized; cycle-safe.
const idCache = new Map<string, boolean>();
function fragmentSelectsId(name: string, seen = new Set<string>()): boolean {
  const cached = idCache.get(name);
  if (cached !== undefined) return cached;
  if (seen.has(name)) return false;
  seen.add(name);
  const def = fragDefs.get(name);
  if (!def) return false;
  let result = false;
  for (const s of def.selectionSet.selections) {
    if (s.kind === Kind.FIELD && s.name.value === 'id') result = true;
    else if (s.kind === Kind.FRAGMENT_SPREAD && fragmentSelectsId(s.name.value, seen))
      result = true;
    else if (s.kind === Kind.INLINE_FRAGMENT && directlySelectsId(s.selectionSet))
      result = true;
  }
  idCache.set(name, result);
  return result;
}

// `id` survives masking only when selected DIRECTLY (named spreads are masked).
// Inline fragments are NOT masked, so an `id` inside one still counts.
function exposesId(selSet: SelectionSetNode | undefined): boolean {
  if (!selSet) return false;
  for (const s of selSet.selections) {
    if (s.kind === Kind.FIELD && s.name.value === 'id') return true;
    if (s.kind === Kind.INLINE_FRAGMENT && exposesId(s.selectionSet)) return true;
  }
  return false;
}

interface Violation {
  file: string;
  path: string;
}

function walk(
  selSet: SelectionSetNode | undefined,
  file: string,
  path: string,
  out: Violation[],
): void {
  if (!selSet) return;
  for (const s of selSet.selections) {
    if (s.kind === Kind.FIELD && s.selectionSet) {
      const here = `${path}.${s.name.value}`;
      const spreadsIdentifiableFragment = s.selectionSet.selections.some(
        c => c.kind === Kind.FRAGMENT_SPREAD && fragmentSelectsId(c.name.value),
      );
      if (spreadsIdentifiableFragment && !exposesId(s.selectionSet)) {
        out.push({ file: relative(SRC, file), path: here });
      }
      walk(s.selectionSet, file, here, out);
    } else if (s.kind === Kind.INLINE_FRAGMENT) {
      walk(s.selectionSet, file, `${path}(${s.typeCondition?.name.value})`, out);
    }
  }
}

describe('GraphQL data-masking identity', () => {
  it('every selection set that spreads an identifiable fragment also selects `id`', () => {
    const violations: Violation[] = [];
    for (const file of files) {
      let doc;
      try {
        doc = parse(readFileSync(file, 'utf8'));
      } catch {
        continue;
      }
      for (const def of doc.definitions) {
        if (def.kind === Kind.OPERATION_DEFINITION) {
          walk(
            def.selectionSet,
            file,
            `${def.operation}:${def.name?.value ?? '(anonymous)'}`,
            violations,
          );
        } else if (def.kind === Kind.FRAGMENT_DEFINITION) {
          walk(def.selectionSet, file, `fragment:${def.name.value}`, violations);
        }
      }
    }

    if (violations.length > 0) {
      const detail = violations
        .map(v => `  • ${v.file}\n      → ${v.path}`)
        .join('\n');
      throw new Error(
        `${violations.length} selection set(s) spread an identifiable fragment ` +
          `without selecting \`id\` directly. Under dataMasking the masked parent ` +
          `loses its key field and useFragment/cache.identify will throw. Add \`id\` ` +
          `to each listed field's selection set:\n${detail}`,
      );
    }

    expect(violations).toEqual([]);
  });

  it('found GraphQL operations/fragments to validate (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(fragDefs.size).toBeGreaterThan(0);
  });
});
