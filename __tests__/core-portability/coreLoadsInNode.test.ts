import * as path from 'node:path';
import { coreModules, ROOT } from './coreModules';

/**
 * Every core file loads with React Native out of reach.
 * Loading a file loads what it imports, so a reach anywhere in its imports
 * fails here, naming the React Native module it got to.
 */
describe('core loads without React Native', () => {
  it('has core files to load', () => {
    expect(coreModules.length).toBeGreaterThan(500);
  });

  it.each(coreModules)('%s', file => {
    expect(() => require(path.join(ROOT, file))).not.toThrow();
  });
});
