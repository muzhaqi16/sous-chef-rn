import { NativeModules, Platform } from 'react-native';

const { WindowBackgroundModule } = NativeModules;

export const WindowBackground = {
  setTheme(theme: string) {
    if (Platform.OS === 'ios' && WindowBackgroundModule) {
      WindowBackgroundModule.setTheme(theme);
    }
  },

  setBackgroundColor(hex: string) {
    if (Platform.OS === 'ios' && WindowBackgroundModule) {
      WindowBackgroundModule.setBackgroundColor(hex);
    }
  },

  setThemeAndBackground(theme: string, hex: string) {
    if (Platform.OS === 'ios' && WindowBackgroundModule) {
      WindowBackgroundModule.setThemeAndBackground(theme, hex);
    }
  },
};
