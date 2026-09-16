/**
 * Every fragment is reachable: spread into an operation, or read by a module
 * through its generated `FragmentDoc`.
 *
 * `@graphql-eslint/no-unused-fragments` cannot express this and is off. It sees
 * only `.graphql` documents, and most fragments here are never spread — the
 * cache writers and optimistic builders pass the generated document to
 * `cache.readFragment` / `writeFragment` from TypeScript. The rule reports every
 * one of those as unused.
 *
 * Matching by the fragment's own name does not work either: codegen renames
 * `usePantryItemActions_id` to `UsePantryItemActions_IdFragmentDoc`, which is
 * the only spelling a module can import. The generated file is what maps one to
 * the other, so that is what this reads.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Kind, parse, visit } from 'graphql';

const SRC = path.join(__dirname, '..', '..', 'src');

const filesUnder = (dir: string, match: (file: string) => boolean): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full, match);
    return match(full) ? [full] : [];
  });

const documents = filesUnder(
  SRC,
  file => file.endsWith('.graphql') && !file.includes(`${path.sep}generated`),
);
const generated = filesUnder(SRC, file => file.endsWith('.generated.ts'));
const modules = filesUnder(
  SRC,
  file =>
    (file.endsWith('.ts') || file.endsWith('.tsx')) &&
    !file.endsWith('.generated.ts'),
);

/** Fragment name → the identifiers codegen exports for it. */
const exportedAs = new Map<string, string[]>();
for (const file of generated) {
  const source = fs.readFileSync(file, 'utf8');
  const pattern =
    /export const (\w+FragmentDoc) =[\s\S]*?"kind":"FragmentDefinition","name":\{"kind":"Name","value":"([^"]+)"/g;
  for (const [, identifier, fragmentName] of source.matchAll(pattern)) {
    exportedAs.set(fragmentName!, [
      ...(exportedAs.get(fragmentName!) ?? []),
      identifier!,
      identifier!.replace(/Doc$/, ''),
    ]);
  }
}

const definedIn = new Map<string, string>();
const spreadsOf = new Map<string, Set<string>>();
const operationRoots: string[] = [];

for (const file of documents) {
  for (const definition of parse(fs.readFileSync(file, 'utf8')).definitions) {
    const spreads = new Set<string>();
    visit(definition, {
      FragmentSpread(node) {
        spreads.add(node.name.value);
      },
    });
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      definedIn.set(definition.name.value, path.relative(SRC, file));
      spreadsOf.set(definition.name.value, spreads);
    } else if (definition.kind === Kind.OPERATION_DEFINITION) {
      operationRoots.push(...spreads);
    }
  }
}

const moduleSource = modules
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');

const readByAModule = [...definedIn.keys()].filter(name =>
  (exportedAs.get(name) ?? []).some(identifier =>
    new RegExp(`\\b${identifier}\\b`).test(moduleSource),
  ),
);

const reachable = new Set<string>();
const queue = [...operationRoots, ...readByAModule];
while (queue.length) {
  const name = queue.pop()!;
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const next of spreadsOf.get(name) ?? []) queue.push(next);
}

describe('fragment reachability', () => {
  it('scans a document set and a module set, so an empty run cannot pass', () => {
    expect(documents.length).toBeGreaterThan(50);
    expect(modules.length).toBeGreaterThan(100);
    expect(definedIn.size).toBeGreaterThan(50);
    // Every fragment has a generated export, or the mapping below is blind.
    expect([...definedIn.keys()].filter(name => !exportedAs.has(name))).toEqual(
      [],
    );
  });

  it('reaches every fragment from an operation or a module', () => {
    const unreachable = [...definedIn.keys()]
      .filter(name => !reachable.has(name))
      .map(name => `${name} (${definedIn.get(name)})`);

    expect(unreachable).toEqual([]);
  });
});
