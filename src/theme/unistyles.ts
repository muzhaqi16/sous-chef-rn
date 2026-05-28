import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { lightTheme, darkTheme } from './themes';
import { breakpoints } from './foundations/breakpoints';

const appThemes: { light: typeof lightTheme; dark: typeof lightTheme } = {
  light: lightTheme,
  dark: darkTheme,
};

type AppBreakpoints = typeof breakpoints;
type AppThemes = typeof appThemes;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  settings: {
    // Runs synchronously at config time — UnistylesRuntime.colorScheme is
    // available immediately from the C++ native layer before any component renders.
    // useTheme() takes full ownership of adaptive theme changes after hydration.
    initialTheme: () =>
      UnistylesRuntime.colorScheme === 'dark' ? 'dark' : 'light',
  },
  breakpoints,
  themes: appThemes,
});
