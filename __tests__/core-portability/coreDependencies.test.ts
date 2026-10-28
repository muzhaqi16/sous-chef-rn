import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The core imports only CORE_EXTERNALS, so none of them may need React Native;
 * every other dependency is unloadable here, by its name or by a subpath.
 */
const { CORE_EXTERNALS, dependenciesOutsideCore } =
  require('../../scripts/lib/layers.js') as {
    CORE_EXTERNALS: string[];
    dependenciesOutsideCore: (dependencies: Record<string, string>) => string[];
  };
const { dependencies } = require('../../package.json') as {
  dependencies: Record<string, string>;
};

const ROOT = path.join(__dirname, '..', '..');
const REACT_NATIVE = /^(react-native($|-)|@react-native)/;

type PackageJson = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

/** What makes a package need React Native: a dependency, or native code. */
function reactNativeTies(name: string): string[] {
  const dir = path.join(ROOT, 'node_modules', name);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
  ) as PackageJson;
  const required = Object.keys(pkg.dependencies ?? {});
  const peers = Object.keys(pkg.peerDependencies ?? {}).filter(
    peer => pkg.peerDependenciesMeta?.[peer]?.optional !== true,
  );
  return [
    ...[...required, ...peers].filter(dep => REACT_NATIVE.test(dep)),
    ...['ios', 'android'].filter(folder =>
      fs.existsSync(path.join(dir, folder)),
    ),
  ];
}

it.each(CORE_EXTERNALS)(
  'core may import %s, which needs no React Native',
  name => {
    expect(reactNativeTies(name)).toEqual([]);
  },
);

it('makes every other dependency unloadable', () => {
  const outside = dependenciesOutsideCore(dependencies);
  expect(outside).toEqual(
    expect.arrayContaining([
      'react-native',
      '@sayem314/react-native-keep-awake',
      'victory-native',
      '@callstack/liquid-glass',
    ]),
  );
  for (const name of outside) {
    expect(() => require(name)).toThrow(`the core loaded "${name}"`);
  }
});

it('makes a subpath of one unloadable too', () => {
  // The deep import lint refuses in source, built here to prove it fails too.
  const subpath = path.posix.join(
    'react-native',
    'Libraries/vendor/emitter/EventEmitter',
  );
  expect(() => require(subpath)).toThrow('the core loaded a subpath');
});
