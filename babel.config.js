export default function (api) {
  api.cache(true);

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      ['react-native-worklets-core/plugin'],
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
            '#': './src',
            '#generated': './src/graphql/generated',
            '#hooks': './src/hooks',
            '#graphql': './src/graphql',
            '#navigation': './src/navigation',
            '#screens': './src/screens',
            '#store': './src/store',
            '#storage': './src/storage',
            '#utils': './src/utils',
            '#assets': './src/assets',
            '#components': './src/components',
            '#types': './src/types',
            '#config': './src/config',
            '#styles': './src/styles',
          },
        },
      ],
      [
        'react-native-unistyles/plugin',
        {
          // pass root folder of your application
          // all files under this folder will be processed by the Babel plugin
          // if you need to include more folders, or customize discovery process
          // check available babel options
          debug: false,
          root: 'src',
        },
      ],
      // react-native-worklets/plugin has to be listed last.
      'react-native-worklets/plugin',
    ],
  };
}
