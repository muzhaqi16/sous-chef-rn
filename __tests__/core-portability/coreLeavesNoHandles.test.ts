import * as path from 'node:path';
import { coreModules, ROOT } from './coreModules';

/**
 * Loading the core starts nothing that outlives it: no timer, socket or
 * interval keeps a host's process alive or runs before the host asked for it.
 */
const countByType = (resources: string[]) =>
  resources.reduce<Record<string, number>>((counts, type) => {
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});

it('loading every core module leaves no timer or socket running', async () => {
  const before = countByType(process.getActiveResourcesInfo());

  for (const file of coreModules) {
    require(path.join(ROOT, file));
  }
  await new Promise(resolve => setImmediate(resolve));

  const after = countByType(process.getActiveResourcesInfo());
  const started = Object.fromEntries(
    Object.entries(after)
      .map(([type, count]) => [type, count - (before[type] ?? 0)] as const)
      .filter(([, added]) => added > 0),
  );
  expect(started).toEqual({});
});
