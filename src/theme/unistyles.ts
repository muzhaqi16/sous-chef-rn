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
    // available from the native layer before any component renders. After
    // rehydration the stored preference drives it (`applyThemePreferenceToRuntime`).
    initialTheme: () => {
      // The library does not export its ColorScheme enum; compare the string it holds.
      const scheme: string = UnistylesRuntime.colorScheme;
      return scheme === 'dark' ? 'dark' : 'light';
    },
  },
  breakpoints,
  themes: appThemes,
});
