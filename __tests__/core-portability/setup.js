'use no memo';
/**
 * The core-portability project's setup: every React-Native-family package the
 * app ships throws when loaded, naming itself, and the in-memory platform
 * is installed before any core module evaluates.
 */
const { dependencies } = require('../../package.json');

const REACT_NATIVE_FAMILY =
  /^(react-native($|-)|@react-native[^/]*\/|@react-navigation\/|@gorhom\/|@shopify\/|@notifee\/)/;

Object.keys(dependencies)
  .filter(name => REACT_NATIVE_FAMILY.test(name))
  .forEach(mockedName => {
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
