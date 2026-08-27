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
      // Unistyles BEFORE the React Compiler, as Unistyles' docs prescribe, with
      // a scope re-crawl wedged between them. The compiler used to run first
      // because Unistyles' `useVariants` rewrite made it bail out of the whole
      // file — but that bail is an upstream scope bug, not an incompatibility,
      // and running the compiler first bought its memoization at the price of
      // variant styles freezing at their first-render value.
      // `unistyles-scope-crawl` fixes the binding so this order compiles AND
      // keeps the variant read in the compiler's cache key. The crawl only
      // works at `Program.enter`, hence its position here — see that file.
      ['react-native-unistyles/plugin', { root: 'src' }],
      './scripts/babel/unistyles-scope-crawl.js',
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
