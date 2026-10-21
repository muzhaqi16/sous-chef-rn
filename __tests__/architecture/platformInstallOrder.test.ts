import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The native install precedes everything that runs the core, and the persisted
 * stores start right after it, before a headless entry can load one. `index.js`
 * imports it right after the startup clock, the startup profiler and the crypto
 * polyfill.
 */
const ROOT = path.join(__dirname, '..', '..');
const INSTALL = './src/app/installNativePlatform';
const BEFORE_INSTALL = [
  './src/services/performance/startupClock',
  './src/services/performance/armStartupProfiling',
  'react-native-get-random-values',
];

const importsOf = (source: string): string[] =>
  [...source.matchAll(/^import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)]
    .map(match => match[1])
    .filter((specifier): specifier is string => specifier !== undefined);

describe('platform install order', () => {
  const imports = importsOf(
    fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8'),
  );

  it('installs the platform right after the clock, profiler and polyfill', () => {
    expect(imports.slice(0, BEFORE_INSTALL.length + 1)).toEqual([
      ...BEFORE_INSTALL,
      INSTALL,
    ]);
  });

  it('starts the persisted stores right after the install', () => {
    const source = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    expect(imports[BEFORE_INSTALL.length + 1]).toBe(
      './src/store/persistedStores',
    );
    // Metro hoists every import above the statements, so the call is the
    // first statement that runs.
    expect(source.match(/^\w[^\n]*\(\);$/m)?.[0]).toBe(
      'startPersistedStores();',
    );
  });

  // Jest evaluates every import eagerly, which Metro's inline requires do not,
  // so this is the stricter of the two: nothing on the path reads a service.
  it('loads what precedes the install without reading a platform service', () => {
    const INSTALLED = Symbol.for('sous-chef.platform');
    const registry = globalThis as { [INSTALLED]?: unknown };
    const installed = registry[INSTALLED];
    delete registry[INSTALLED];
    let thrown: unknown;
    jest.isolateModules(() => {
      try {
        for (const specifier of BEFORE_INSTALL.filter(own =>
          own.startsWith('./src/'),
        )) {
          require(path.join(ROOT, specifier));
        }
      } catch (error) {
        thrown = error;
      }
    });
    registry[INSTALLED] = installed;

    expect(thrown).toBeUndefined();
  });

  it('reads the imports of index.js', () => {
    expect(imports).toEqual(
      expect.arrayContaining(['./src/i18n/config', './App']),
    );
  });
});
