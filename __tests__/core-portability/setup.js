'use no memo';
/**
 * The core-portability project's setup: every dependency outside
 * CORE_EXTERNALS throws when loaded, naming itself, and the in-memory platform
 * is installed and the persisted stores started. A subpath of one
 * (`react-native/Libraries/…`) is another specifier, so `jest.config.js` maps
 * those to a stub that throws too.
 */
const { dependencies } = require('../../package.json');
const { dependenciesOutsideCore } = require('../../scripts/lib/layers');

dependenciesOutsideCore(dependencies).forEach(mockedName => {
  jest.mock(mockedName, () => {
    throw new Error(`core-portability: the core loaded "${mockedName}"`);
  });
});

// Both hosts schedule frames, React Native and the browser alike; node does
// not, so a frame is a timer here.
globalThis.requestAnimationFrame ??= callback =>
  setTimeout(() => callback(Date.now()), 16);
globalThis.cancelAnimationFrame ??= handle => clearTimeout(handle);

require('../helpers/memoryPlatform').installMemoryPlatform();
require('../../src/store/persistedStores').startPersistedStores();
