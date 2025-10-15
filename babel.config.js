module.exports = {
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
          '#assets': './src/assets',
          '#components': './src/components',
          '#constants': './src/constants',
          '#config': './src/config',
          '#context': './src/context',
          '#context/*': './src/context/*',
          '#contexts': './src/contexts',
          '#generated': './src/graphql/generated',
          '#graphql': './src/graphql',
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
    [
      'react-native-unistyles/plugin',
      {
        // pass root folder of your application
        // all files under this folder will be processed by the Babel plugin
        // if you need to include more folders, or customize discovery process
        // check available babel options
        root: 'src',
      },
    ],
    // react-native-worklets/plugin has to be listed last.
    'react-native-worklets/plugin',
  ],
};
