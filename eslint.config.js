/**
 * Composition only: the React Native preset, then the project's rules from
 * `eslint/project.js`. Array order is precedence — see that file.
 */
const graphqlPlugin = require('@graphql-eslint/eslint-plugin');
const reactNativeConfig = require('@react-native/eslint-config/flat');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const espree = require('espree');
const boundariesPlugin = require('eslint-plugin-boundaries');
const importPlugin = require('eslint-plugin-import');
const i18nextPlugin = require('eslint-plugin-i18next');
const noBarrelFilesPlugin = require('eslint-plugin-no-barrel-files');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const jestPlugin = require('eslint-plugin-jest');
const testingLibraryPlugin = require('eslint-plugin-testing-library');
const sousChefPlugin = require('./eslint/plugin');
const { base, overrides } = require('./eslint/project');

// `flat/operations-recommended` flattened to a rule map.
const graphqlPreset = graphqlPlugin.configs['flat/operations-recommended'];
const graphqlOperationsConfig = {
  rules: Array.isArray(graphqlPreset)
    ? Object.assign({}, ...graphqlPreset.map(entry => entry.rules ?? {}))
    : graphqlPreset.rules,
};

// Every rule is 'error' or 'off': lint passes --max-warnings 0, so a preset's
// 'warn' already blocks and only reads as optional.
const promoteWarning = entry => {
  if (Array.isArray(entry))
    return [promoteWarning(entry[0]), ...entry.slice(1)];
  return entry === 1 || entry === 'warn' ? 'error' : entry;
};
const errorsOnly = config =>
  config.rules
    ? {
        ...config,
        rules: Object.fromEntries(
          Object.entries(config.rules).map(([id, entry]) => [
            id,
            promoteWarning(entry),
          ]),
        ),
      }
    : config;

module.exports = [
  {
    ignores: [
      'src/graphql/generated/**/*',
      'src/**/*.generated.ts',
      'coverage/**/*',
      '**/.*',
      '**/.*/',
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  ...reactNativeConfig.map(errorsOnly),
  errorsOnly(reactHooksPlugin.configs.flat['recommended-latest']),
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { parser: espree },
  },
  {
    files: ['**/*.graphql'],
    languageOptions: { parser: graphqlPlugin.parser },
  },
  {
    // The preset registers @typescript-eslint for .ts/.tsx only, but the base
    // rules name it for every file; this is the same plugin object.
    plugins: {
      'sous-chef': sousChefPlugin,
      '@typescript-eslint': typescriptPlugin,
      '@graphql-eslint': graphqlPlugin,
      i18next: i18nextPlugin,
      import: importPlugin,
      boundaries: boundariesPlugin,
      'testing-library': testingLibraryPlugin,
      'no-barrel-files': noBarrelFilesPlugin,
    },
    ...base,
  },
  // `eslint-plugin-jest`'s recommended set, composed here for the same reason
  // as the GraphQL one below, and promoted to errors like every other preset.
  // The project's own test-file override follows, and so wins.
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: errorsOnly(jestPlugin.configs['flat/recommended']).rules,
  },
  // The operations preset, composed here because it carries plugin objects:
  // `eslint/project.js` stays pure data so the Jest guards can read it. The
  // project's own `**/*.graphql` override follows, and so wins.
  {
    files: ['**/*.graphql'],
    rules: errorsOnly(graphqlOperationsConfig).rules,
  },
  ...overrides,
];
