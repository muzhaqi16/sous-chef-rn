const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');
const { generateEnv } = require('./scripts/generate-env');

// Regenerate the build-time config (src/config/env.generated.ts) whenever Metro
// starts or bundles — honors ENVFILE/process.env, so the dev server,
// `run-ios/android`, release bundling, and CI all pick up the active env
// without per-script wiring.
generateEnv();

const defaultConfig = getDefaultConfig(__dirname);

// Directories that only ever hold native build artifacts. Metro never bundles
// them, but the default file map still crawls and `fs.watch`-es every file
// inside — including the thousands of files under each `node_modules/<pkg>/
// android/.cxx/.../prefab/...` tree. On Linux that exhausts the inotify
// watch limit (ENOSPC) and crashes Metro. Excluding them here means
// metro-file-map never walks or watches them in the first place.
const blockedNativeBuildDirs = [
  /\/android\/\.cxx\/.*/,
  /\/android\/build\/.*/,
  /\/android\/app\/build\/.*/,
  /\/android\/\.gradle\/.*/,
  /\/\.gradle\/.*/,
  /\/ios\/build\/.*/,
  /\/ios\/Pods\/.*/,
];

const existingBlockList = Array.isArray(defaultConfig.resolver.blockList)
  ? defaultConfig.resolver.blockList
  : [defaultConfig.resolver.blockList];

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve(
      'react-native-svg-transformer/react-native',
    ),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: true,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    assetExts: defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    blockList: [
      ...existingBlockList.filter(Boolean),
      ...blockedNativeBuildDirs,
    ],
  },
};

module.exports = wrapWithReanimatedMetroConfig(
  mergeConfig(defaultConfig, config),
);
