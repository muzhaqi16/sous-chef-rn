/**
 * Composition only: the React Native preset, then the project's rules from
 * `eslint/project.js`. Array order is precedence — see that file.
 */
const graphqlPlugin = require('@graphql-eslint/eslint-plugin');
const reactNativeConfig = require('@react-native/eslint-config/flat');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const espree = require('espree');
const importPlugin = require('eslint-plugin-import');
const i18nextPlugin = require('eslint-plugin-i18next');
const noBarrelFilesPlugin = require('eslint-plugin-no-barrel-files');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const sousChefPlugin = require('./eslint/plugin');
const { base, overrides } = require('./eslint/project');

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
      'no-barrel-files': noBarrelFilesPlugin,
    },
    ...base,
  },
  ...overrides,
];
