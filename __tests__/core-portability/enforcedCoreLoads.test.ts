import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Every file of an enforced core entry loads with React Native out of reach.
 * Loading a file loads what it imports, so a reach anywhere in its imports
 * fails here, naming the React Native module it got to.
 */
type LayerEntry = {
  name: string;
  layer: 'core' | 'mobile';
  patterns: string[];
  enforced: boolean;
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

const enforced = LAYERS.filter(
  entry => entry.layer === 'core' && entry.enforced,
);

const enforcedModules = filesUnder(path.join(ROOT, 'src'))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isProductionFile)
  .filter(file => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
  .filter(file => matchingEntries(file, enforced).length > 0);

describe('enforced core loads without React Native', () => {
  it('has enforced core files to load', () => {
    expect(enforcedModules.length).toBeGreaterThan(0);
  });

  it.each(enforcedModules)('%s', file => {
    expect(() => require(path.join(ROOT, file))).not.toThrow();
  });
});
