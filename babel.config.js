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
        },
      },
    ],
    // react-native-reanimated/plugin has to be listed last.
    'react-native-reanimated/plugin',
  ],
};
