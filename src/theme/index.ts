import {StyleSheet} from 'react-native-unistyles';
import {lightTheme, darkTheme} from './themes';
import {breakpoints} from './foundations/breakpoints';

const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

// Re-export all theme utilities
export * from './foundations';
export * from './themes';
export * from './utilities';

type AppThemes = typeof appThemes;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  settings: {
    adaptiveThemes: false,
    initialTheme: 'light',
  },
  breakpoints,
  themes: appThemes,
});
