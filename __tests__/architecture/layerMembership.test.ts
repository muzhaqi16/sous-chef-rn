import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Every production file in `src/` belongs to exactly one layer of
 * `scripts/lib/layers.js`. A file no entry claims is outside every layer gate,
 * and one two entries claim is in whichever a tool reads first.
 */
type LayerEntry = {
  name: string;
  layer: 'core' | 'mobile';
  patterns: string[];
};

const { LAYERS, isProductionFile, matchingEntries } =
  require('../../scripts/lib/layers.js') as {
    LAYERS: LayerEntry[];
    isProductionFile: (file: string) => boolean;
    matchingEntries: (file: string, entries?: LayerEntry[]) => LayerEntry[];
  };

const ROOT = path.join(__dirname, '..', '..');

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const productionFiles = filesUnder(path.join(ROOT, 'src'))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isProductionFile);

const misclassified = (files: string[], entries: LayerEntry[]) =>
  files
    .map(file => ({
      file,
      entries: matchingEntries(file, entries).map(entry => entry.name),
    }))
    .filter(({ entries: matched }) => matched.length !== 1);

describe('layer membership', () => {
  it('reads a non-empty source tree', () => {
    expect(productionFiles.length).toBeGreaterThan(1000);
  });

  it('places every production file in exactly one layer entry', () => {
    expect(misclassified(productionFiles, LAYERS)).toEqual([]);
  });

  it('reports a file no entry claims, and one two entries claim', () => {
    const overlapping: LayerEntry[] = [
      ...LAYERS,
      {
        name: 'overlap',
        layer: 'mobile',
        patterns: ['src/apollo/client.ts'],
      },
    ];

    expect(
      misclassified(
        ['src/unclassified/thing.ts', 'src/apollo/client.ts'],
        overlapping,
      ),
    ).toEqual([
      { file: 'src/unclassified/thing.ts', entries: [] },
      { file: 'src/apollo/client.ts', entries: ['apollo', 'overlap'] },
    ]);
  });

  it('leaves tests, mocks and docs out of every layer', () => {
    expect(
      [
        'src/apollo/__tests__/client.test.ts',
        'src/storage/__mocks__/mmkv.ts',
        'src/features/shoppingList/context/ShoppingListModalsContext.test.tsx',
        'src/app/README.md',
      ].filter(isProductionFile),
    ).toEqual([]);
  });
});
