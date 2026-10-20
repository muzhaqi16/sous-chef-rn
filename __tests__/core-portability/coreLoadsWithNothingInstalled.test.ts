import * as path from 'node:path';
import { coreModules, ROOT } from './coreModules';

/**
 * Every core file loads before the host installs anything or starts the
 * persisted stores: a platform service is read where it is used, never while
 * a module loads, so the order a bundler evaluates modules in cannot decide
 * whether the application starts.
 */
const INSTALLED = Symbol.for('sous-chef.platform');
const STARTED = Symbol.for('sous-chef.persistedStoresStarted');
const registry = globalThis as { [INSTALLED]?: unknown; [STARTED]?: boolean };
const setupInstall = registry[INSTALLED];

beforeAll(() => {
  delete registry[INSTALLED];
  delete registry[STARTED];
});

afterAll(() => {
  registry[INSTALLED] = setupInstall;
  registry[STARTED] = true;
});

it.each(coreModules)('%s', file => {
  expect(() => require(path.join(ROOT, file))).not.toThrow();
});
