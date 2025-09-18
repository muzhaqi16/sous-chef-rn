import { StyleSheet } from 'react-native-unistyles';
import { lightTheme, darkTheme } from './themes';
import { breakpoints } from './foundations/breakpoints';
import { useStore } from '#store';

const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

// Re-export all theme utilities
export * from './foundations';
export * from './themes';
export * from './utilities';

type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  settings: {
    initialTheme: () => {
      const { theme } = useStore.getState();
      return theme === 'system' ? 'light' : theme; // Default to light if system
    },

    adaptiveThemes: false, // Let Unistyles handle theme switching automatically
  },
  breakpoints,
  themes: appThemes,
});
