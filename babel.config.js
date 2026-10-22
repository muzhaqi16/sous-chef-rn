const { babelAliases } = require('./scripts/lib/aliases');

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
      // Unistyles BEFORE the React Compiler, as Unistyles' docs prescribe. With
      // the compiler first, a `useVariants` style read is cached on the wrong
      // dependencies and freezes at its first-render value
      // (`check:unistyles-variants`).
      ['react-native-unistyles/plugin', { root: 'src' }],
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
          // Derived from tsconfig.json — see scripts/lib/aliases.js. This list
          // used to be maintained by hand alongside two others that disagreed
          // with it and with each other.
          alias: babelAliases(),
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
