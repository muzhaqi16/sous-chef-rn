/** @type {import('react-native-worklets/plugin').PluginOptions} */
// https://docs.swmansion.com/react-native-worklets/docs/
const workletsPluginOptions = {
  strictGlobal: true,
};

module.exports = api => {
  const isTest = api.env('test');
  return {
    presets: [
      [
        'module:@react-native/babel-preset',
        { disableImportExportTransform: !isTest },
      ],
    ],
    plugins: [
      // Unistyles must run BEFORE React Compiler so the compiler sees
      // transformed theme accesses and can properly memoize them.
      // See: https://www.unistyl.es/v3/guides/react-compiler/
      ['react-native-unistyles/plugin', { root: 'src' }],

      // React Compiler for automatic memoization (after Unistyles transform)
      'babel-plugin-react-compiler',
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: [
            '.ios.ts',
            '.android.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
          alias: {
            '#/test-utils': './__tests__/helpers',
            '#': './src',
            '#assets': './src/assets',
            '#components': './src/components',
            '#constants': './src/constants',
            '#config': './src/config',
            '#context': './src/context',
            '#context/*': './src/context/*',
            '#features': './src/features',
            '#features/*': './src/features/*',
            '#generated': './src/graphql/generated',
            '#graphql': './src/graphql',
            '#operations': './src/graphql/operations',
            '#hooks': './src/hooks',
            '#hooks/*': './src/hooks/*',
            '#navigation': './src/navigation',
            '#screens': './src/screens',
            '#screens/*': './src/screens/*',
            '#services': './src/services',
            '#services/*': './src/services/*',
            '#storage': './src/storage',
            '#storage/*': './src/storage/*',
            '#store': './src/store',
            '#styles': './src/styles',
            '#types': './src/types',
            '#utils': './src/utils',
          },
        },
      ],

      // api.env() reads BABEL_ENV, which Metro sets to 'production' during
      // release bundling (a NODE_ENV check never fires there — NODE_ENV is
      // only written to the .env file for generate-env.js, not the process).
      api.env('production') && [
        'transform-remove-console',
        { exclude: ['error', 'warn'] },
      ],
      // react-native-worklets/plugin has to be listed last.
      ['react-native-worklets/plugin', workletsPluginOptions],
    ].filter(Boolean),
  };
};
