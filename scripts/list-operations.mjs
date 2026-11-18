/**
 * Writes every operation the app sends, each with the fragments it spreads, as
 * `{ operations: [{ id, name, body }] }`: what `api-schema-check` holds against
 * each schema production serves.
 *   node scripts/list-operations.mjs <out.json>
 */
import { createRequire } from 'node:module';
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { parse, print, visit, Kind } = require('graphql');
const { operationGlobs } = require('./lib/sourceRoots.js');

const [, , out] = process.argv;
if (!out) {
  console.error('usage: node scripts/list-operations.mjs <out.json>');
  process.exit(2);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Anchored on a path segment: `exclude` sees bare directory names too.
const files = globSync(operationGlobs(), {
  cwd: repoRoot,
  exclude: p => /(^|\/)graphql\/generated(\/|$)/.test(p),
}).sort();

const fragments = new Map();
const operations = new Map();
for (const file of files) {
  const { definitions } = parse(readFileSync(join(repoRoot, file), 'utf8'));
  for (const definition of definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    } else if (definition.kind === Kind.OPERATION_DEFINITION) {
      const name = definition.name?.value;
      if (!name) throw new Error(`${file} holds an unnamed operation`);
      // Codegen tolerates identical copies of an operation in two files.
      if (!operations.has(name)) operations.set(name, definition);
    }
  }
}

const spreadsOf = node => {
  const names = [];
  visit(node, {
    FragmentSpread: spread => {
      names.push(spread.name.value);
    },
  });
  return names;
};

const bodyOf = (name, operation) => {
  const needed = new Map();
  const pending = spreadsOf(operation);
  while (pending.length > 0) {
    const fragmentName = pending.pop();
    if (needed.has(fragmentName)) continue;
    const fragment = fragments.get(fragmentName);
    if (!fragment) throw new Error(`${name} spreads unknown ${fragmentName}`);
    needed.set(fragmentName, fragment);
    pending.push(...spreadsOf(fragment));
  }
  const used = [...needed.keys()].sort().map(key => needed.get(key));
  return [operation, ...used].map(definition => print(definition)).join('\n\n');
};

const listed = [...operations]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, operation]) => ({
    id: name,
    name,
    body: bodyOf(name, operation),
  }));
writeFileSync(out, `${JSON.stringify({ operations: listed }, null, 2)}\n`);
console.log(`✓ ${listed.length} operations written to ${out}`);
