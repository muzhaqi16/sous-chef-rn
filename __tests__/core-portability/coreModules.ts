import * as fs from 'node:fs';
import * as path from 'node:path';

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

export const ROOT = path.join(__dirname, '..', '..');

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const core = LAYERS.filter(entry => entry.layer === 'core');

/** Every production core file, repo-relative. */
export const coreModules = filesUnder(path.join(ROOT, 'src'))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isProductionFile)
  .filter(file => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
  .filter(file => matchingEntries(file, core).length > 0);
