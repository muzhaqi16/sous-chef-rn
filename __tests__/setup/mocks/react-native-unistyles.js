'use no memo';
jest.mock('react-native-unistyles', () => {
  const { lightTheme } = require('../../../src/theme/themes');

  // The runtime, declared ONCE and handed to every consumer below.
  //
  // `StyleSheet.create(theme => ...)` is the common shape, but the real
  // signature is `(theme, rt)` and a stylesheet is entitled to read `rt` —
  // `rt.screen.height`, `rt.insets`, `rt.colorScheme`. Passing only the theme
  // made any such file throw while being IMPORTED, which surfaces as
  // "Test suite failed to run", not as a failing assertion, and takes down
  // every suite that transitively imports it. Note a stylesheet reads `rt`
  // once at evaluation, so these are constants here as they are in the app.
  const runtime = {
    colorScheme: 'light',
    themeName: 'light',
    contentSizeCategory: 'Medium',
    breakpoint: undefined,
    orientation: 'portrait',
    pixelRatio: 2,
    fontScale: 1,
    screen: { width: 390, height: 844 },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    statusBar: { width: 390, height: 44 },
    navigationBar: { width: 390, height: 0 },
  };

  return {
    StyleSheet: {
      create: styleFnOrObj => {
        const result =
          typeof styleFnOrObj === 'function'
            ? styleFnOrObj(lightTheme, runtime)
            : styleFnOrObj;
        result.useVariants = jest.fn();
        return result;
      },
      configure: jest.fn(),
      // Unistyles' StyleSheet is a superset of RN's — delegate the
      // original utilities so tests can flatten style arrays.
      flatten: style => require('react-native').StyleSheet.flatten(style),
    },
    useUnistyles: jest.fn(() => ({
      theme: lightTheme,
      styles: {},
      rt: runtime,
    })),
    useStyles: jest.fn(stylesheet => ({
      styles:
        typeof stylesheet === 'function'
          ? stylesheet(lightTheme, runtime)
          : stylesheet || {},
      theme: lightTheme,
    })),
    useInitialTheme: jest.fn(),
    withUnistyles: jest.fn(component => component),
    UnistylesRuntime: {
      setTheme: jest.fn(),
      setAdaptiveThemes: jest.fn(),
      getTheme: jest.fn(() => lightTheme),
      ...runtime,
    },
  };
});

jest.mock('react-native-unistyles/reanimated', () => {
  const { lightTheme } = require('../../../src/theme/themes');

  return {
    useAnimatedTheme: jest.fn(() => ({ value: lightTheme })),
  };
});
