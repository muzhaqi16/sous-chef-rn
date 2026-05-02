'use no memo';
/**
 * Jest Global Setup
 *
 * - Official library mocks are used where they work out of the box
 * - Custom mocks for packages without usable official mocks live in __tests__/setup/mocks/
 * - Simple mocks live in __mocks__/ (automatic Jest resolution for node_modules)
 * - ORDERING: react-native-nitro-modules is resolved via moduleNameMapper (jest.config.js)
 */

// ---------------------------------------------------------------------------
// Official library mocks
// ---------------------------------------------------------------------------
jest.mock('@notifee/react-native', () =>
  require('@notifee/react-native/jest-mock'),
);
jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);

// ---------------------------------------------------------------------------
// Custom mocks (no usable official mock, or official mock is inadequate)
// ---------------------------------------------------------------------------
// Unistyles must be first — depends on nitro-modules (resolved via moduleNameMapper)
require('./__tests__/setup/mocks/react-native-unistyles');
require('./__tests__/setup/mocks/react-native-reanimated');
require('./__tests__/setup/mocks/react-native-gesture-handler');
require('./__tests__/setup/mocks/react-native-safe-area-context');
require('./__tests__/setup/mocks/react-navigation-native');
require('./__tests__/setup/mocks/gorhom-bottom-sheet');
require('./__tests__/setup/mocks/react-native-mmkv');
require('./__tests__/setup/mocks/react-native-device-info');
require('./__tests__/setup/mocks/react-native-keychain');
require('./__tests__/setup/mocks/react-native-keyboard-controller');
require('./__tests__/setup/mocks/react-native-performance');
require('./__tests__/setup/mocks/shopify-flash-list');
require('./__tests__/setup/mocks/shopify-react-native-skia');
require('./__tests__/setup/mocks/react-native-vision-camera');

// ---------------------------------------------------------------------------
// Globals (polyfills, console suppression)
// ---------------------------------------------------------------------------
require('./__tests__/setup/globals');
