import * as fs from 'node:fs';
import * as path from 'node:path';
import { Kind, parse, visit, type DefinitionNode } from 'graphql';
import { OPERATION_ROOT_DIRS } from '#/test-utils/sourceRoots';

/**
 * A core document includes only core fragments. A fragment a screen or
 * component owns belongs to that UI, so a core operation that spreads one
 * serves only that UI: a second host would have to write its own copy of the
 * operation, and the core would hold two. A write spreads `...<Type>Readers`
 * instead; a query that renders a UI's fragments lives beside that UI.
 */
type LayerEntry = { layer: 'core' | 'mobile' };

const { isProductionFile, matchingEntries } =
  require('../../scripts/lib/layers.js') as {
    isProductionFile: (file: string) => boolean;
    matchingEntries: (file: string) => LayerEntry[];
  };

const ROOT = path.join(__dirname, '..', '..');

type Definition = { name: string; file: string; spreads: string[] };

const definitionName = (definition: DefinitionNode): string | null =>
  definition.kind === Kind.OPERATION_DEFINITION ||
  definition.kind === Kind.FRAGMENT_DEFINITION
    ? definition.name?.value ?? null
    : null;

/** Each named definition in `source`, with the fragments it spreads directly. */
export function definitionsIn(file: string, source: string): Definition[] {
  return parse(source).definitions.flatMap(definition => {
    const name = definitionName(definition);
    if (!name) return [];
    const spreads: string[] = [];
    visit(definition, {
      FragmentSpread: node => {
        spreads.push(node.name.value);
      },
    });
    return [{ name, file, spreads }];
  });
}

const layerOf = (file: string): 'core' | 'mobile' | null =>
  matchingEntries(file)[0]?.layer ?? null;

/** Every core definition that reaches a fragment a mobile file defines. */
export function mobileFragmentsInCore(
  definitions: Definition[],
  layer: (file: string) => 'core' | 'mobile' | null = layerOf,
): string[] {
  const fragments = new Map(definitions.map(d => [d.name, d]));
  const reached = (start: Definition): Definition[] => {
    const seen = new Set<string>();
    const out: Definition[] = [];
    const queue = [...start.spreads];
    for (let name = queue.shift(); name; name = queue.shift()) {
      const fragment = fragments.get(name);
      if (seen.has(name) || !fragment) continue;
      seen.add(name);
      out.push(fragment);
      queue.push(...fragment.spreads);
    }
    return out;
  };
  return definitions
    .filter(d => layer(d.file) === 'core')
    .flatMap(d =>
      reached(d)
        .filter(fragment => layer(fragment.file) === 'mobile')
        .map(fragment => `${d.name} (${d.file}) includes ${fragment.name}`),
    );
}

function graphqlFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'generated' ? [] : graphqlFilesUnder(full);
    }
    return entry.name.endsWith('.graphql') ? [full] : [];
  });
}

const definitions = OPERATION_ROOT_DIRS.flatMap(dir => graphqlFilesUnder(dir))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isProductionFile)
  .flatMap(file =>
    definitionsIn(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
  );

describe('document ownership', () => {
  it('reads the documents it judges', () => {
    expect(definitions.length).toBeGreaterThan(200);
  });

  it('holds every core document to core fragments', () => {
    expect(mobileFragmentsInCore(definitions)).toEqual([]);
  });

  it('names the operation and the fragment it reaches', () => {
    const synthetic = [
      ...definitionsIn(
        'src/features/x/hooks/useX.graphql',
        'query X { x { ...XCard_x } }',
      ),
      ...definitionsIn(
        'src/features/x/components/XCard.graphql',
        'fragment XCard_x on X { ...XCardBadge_x }',
      ),
      ...definitionsIn(
        'src/features/x/components/XCardBadge.graphql',
        'fragment XCardBadge_x on X { id }',
      ),
    ];
    const layer = (file: string) =>
      file.includes('/components/') ? 'mobile' : 'core';

    expect(mobileFragmentsInCore(synthetic, layer)).toEqual([
      'X (src/features/x/hooks/useX.graphql) includes XCard_x',
      'X (src/features/x/hooks/useX.graphql) includes XCardBadge_x',
    ]);
  });
});
