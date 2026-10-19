import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Core modules read platform services when they evaluate, so the native install
 * must be evaluated before the first of them. `index.js` imports it right after
 * the startup clock, the startup profiler and the crypto polyfill.
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

  it('reads the imports of index.js', () => {
    expect(imports).toEqual(
      expect.arrayContaining(['./src/i18n/config', './App']),
    );
  });
});
