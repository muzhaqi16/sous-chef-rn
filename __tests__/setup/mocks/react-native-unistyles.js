'use no memo';
jest.mock('react-native-unistyles', () => {
  const { lightTheme } = require('../../../src/theme/themes');

  return {
    StyleSheet: {
      create: styleFnOrObj => {
        const result =
          typeof styleFnOrObj === 'function'
            ? styleFnOrObj(lightTheme)
            : styleFnOrObj;
        result.useVariants = jest.fn();
        return result;
      },
      configure: jest.fn(),
    },
    useUnistyles: jest.fn(() => ({
      theme: lightTheme,
      styles: {},
      rt: {
        themeName: 'light',
        colorScheme: 'light',
      },
    })),
    useStyles: jest.fn(stylesheet => ({
      styles:
        typeof stylesheet === 'function'
          ? stylesheet(lightTheme)
          : stylesheet || {},
      theme: lightTheme,
    })),
    useInitialTheme: jest.fn(),
    withUnistyles: jest.fn(component => component),
    UnistylesRuntime: {
      setTheme: jest.fn(),
      setAdaptiveThemes: jest.fn(),
      getTheme: jest.fn(() => lightTheme),
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
    },
  };
});

jest.mock('react-native-unistyles/reanimated', () => {
  const { lightTheme } = require('../../../src/theme/themes');

  return {
    useAnimatedTheme: jest.fn(() => ({ value: lightTheme })),
  };
});
