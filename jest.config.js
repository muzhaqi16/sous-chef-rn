module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-native|' +
      'react-native|' +
      'react-native-unistyles|' +
      'react-native-reanimated|' +
      'react-native-gesture-handler|' +
      'react-native-safe-area-context|' +
      'react-native-screens|' +
      'react-native-svg|' +
      '@gorhom/bottom-sheet|' +
      'react-native-draggable-flatlist|' +
      'react-native-keyboard-aware-scroll-view|' +
      'react-native-permissions|' +
      'react-native-vision-camera|' +
      'react-native-image-picker|' +
      'react-native-keychain|' +
      'react-native-mmkv|' +
      'react-native-get-random-values|' +
      'react-native-device-info|' +
      'react-native-config|' +
      '@react-native-clipboard/clipboard|' +
      '@react-native-community|' +
      '@react-navigation|' +
      '@notifee/react-native|' +
      'immer|' +
      'zustand|' +
      'uuid' +
      ')/)',
  ],
};
