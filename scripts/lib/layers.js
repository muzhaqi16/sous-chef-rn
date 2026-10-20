/**
 * The layer every production file in `src/` belongs to, by folder.
 *
 * `core` runs without React Native; `mobile` is the React Native app. Lint,
 * Jest and scripts read this one map. A file belongs to exactly one entry
 * (`layerMembership.test.ts`), so a new folder is classified the day it
 * exists; a file that mixes layers moves, the map does not grow an exception.
 *
 * Patterns use `*`, `**` and `{a,b}` only, so they mean the same here as in
 * eslint-plugin-boundaries' micromatch. CommonJS because the ESLint and Jest
 * configs load it before any transform runs.
 */

/** @typedef {{ name: string, layer: 'core' | 'mobile', patterns: string[] }} LayerEntry */

/** @type {LayerEntry[]} */
const LAYERS = [
  {
    name: 'platform',
    layer: 'core',
    patterns: ['src/platform/**'],
  },
  {
    name: 'apollo',
    layer: 'core',
    patterns: ['src/apollo/**'],
  },
  {
    name: 'bootstrap',
    layer: 'core',
    patterns: ['src/bootstrap/**'],
  },
  {
    name: 'domain',
    layer: 'core',
    patterns: ['src/domain/**'],
  },
  {
    name: 'graphql',
    layer: 'core',
    patterns: ['src/graphql/**'],
  },
  { name: 'i18n', layer: 'core', patterns: ['src/i18n/**'] },
  {
    name: 'config',
    layer: 'core',
    patterns: ['src/config/**'],
  },
  { name: 'store', layer: 'core', patterns: ['src/store/**'] },
  { name: 'types', layer: 'core', patterns: ['src/types/**'] },
  { name: 'utils', layer: 'core', patterns: ['src/utils/**'] },
  {
    name: 'services/auth',
    layer: 'core',
    patterns: ['src/services/auth/**', 'src/services/authService.ts'],
  },
  {
    name: 'services',
    layer: 'core',
    patterns: [
      'src/services/{subscriptions,spoonacular,telemetry}/**',
      'src/services/{alertService,destructiveConfirm,errorService,toastService}.ts',
    ],
  },
  {
    name: 'hooks',
    layer: 'core',
    patterns: [
      'src/hooks/{apollo,auth,data,deepLink,search,settings,utils}/**',
    ],
  },
  {
    name: 'hooks/session',
    layer: 'core',
    patterns: ['src/hooks/{app,offline,subscriptions}/**'],
  },
  {
    name: 'theme/foundations',
    layer: 'core',
    patterns: ['src/theme/foundations/**'],
  },
  {
    name: 'features/utils',
    layer: 'core',
    patterns: ['src/features/*/utils/**'],
  },
  {
    name: 'features/graphql',
    layer: 'core',
    patterns: ['src/features/*/graphql/**'],
  },
  {
    name: 'features/cache',
    layer: 'core',
    patterns: ['src/features/*/cache/**'],
  },
  {
    name: 'features/data',
    layer: 'core',
    patterns: ['src/features/*/{hooks,offline,store,locales,constants}/**'],
  },
  {
    name: 'features/declarations',
    layer: 'core',
    patterns: [
      'src/features/*/{manifest.static,types,pushCopy}.ts',
      'src/features/{registry.static,registry.cache,staticTypes}.ts',
    ],
  },

  {
    name: 'app shell',
    layer: 'mobile',
    patterns: [
      'src/{app,assets,components,constants,context,native,navigation,screens,styles}/**',
    ],
  },
  {
    name: 'services (device)',
    layer: 'mobile',
    patterns: [
      'src/services/{push,permissions,haptic,notifications,performance,biometric,device}/**',
      'src/services/NavigationService.ts',
    ],
  },
  {
    name: 'hooks (UI and device)',
    layer: 'mobile',
    patterns: [
      'src/hooks/{ui,animations,navigation,permissions,performance,device}/**',
    ],
  },
  {
    name: 'theme runtime',
    layer: 'mobile',
    patterns: ['src/theme/*.ts'],
  },
  {
    name: 'features (UI)',
    layer: 'mobile',
    patterns: [
      'src/features/*/{screens,components,ui,context}/**',
      'src/features/*/{manifest,testIDs}.ts',
      'src/features/{registry,types}.ts',
    ],
  },
];

const escapeRegExp = text => text.replace(/[.+^$()|[\]\\]/g, '\\$&');

/** `*`, `**` and `{a,b}` to an anchored RegExp over a `/`-separated path. */
function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (glob.startsWith('**/', i)) {
      out += '(?:.*/)?';
      i += 2;
    } else if (glob.startsWith('**', i)) {
      out += '.*';
      i += 1;
    } else if (char === '*') {
      out += '[^/]*';
    } else if (char === '{') {
      const end = glob.indexOf('}', i);
      const options = glob
        .slice(i + 1, end)
        .split(',')
        .map(escapeRegExp);
      out += `(?:${options.join('|')})`;
      i = end;
    } else {
      out += escapeRegExp(char);
    }
  }
  return new RegExp(`^${out}$`);
}

// What the core may import from node_modules: modules that run without React
// Native. Lint holds the core to it, and the core-portability project makes
// every other dependency throw when loaded.
const CORE_EXTERNALS = [
  'react',
  '@apollo/client',
  '@apollo/persisted-query-lists',
  'rxjs',
  'graphql',
  'graphql-ws',
  'zustand',
  'immer',
  'i18next',
  'react-i18next',
  'yup',
  'react-hook-form',
  '@hookform/resolvers',
  'date-fns',
  'fraction.js',
  'fractional-indexing',
  'fuse.js',
  '@paralleldrive/cuid2',
  'uuid',
  'jwt-decode',
  'js-sha256',
  'chroma-js',
  '@muzhaqi16/receipt-rules',
];

/** The dependencies the core may not load: every one outside CORE_EXTERNALS. */
const dependenciesOutsideCore = dependencies =>
  Object.keys(dependencies).filter(name => !CORE_EXTERNALS.includes(name));

/** Test and mock files, and docs, belong to no layer. */
const isProductionFile = file =>
  !/(^|\/)(__tests__|__mocks__)\//.test(file) &&
  !/\.(test|spec)\.[jt]sx?$/.test(file) &&
  !file.endsWith('.md');

/** Every entry whose patterns match `file`, a repo-relative `/` path. */
function matchingEntries(file, entries = LAYERS) {
  return entries.filter(entry =>
    entry.patterns.some(pattern => globToRegExp(pattern).test(file)),
  );
}

module.exports = {
  CORE_EXTERNALS,
  LAYERS,
  dependenciesOutsideCore,
  isProductionFile,
  matchingEntries,
};
