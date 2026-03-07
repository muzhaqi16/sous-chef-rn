import { NativeModules, Platform } from 'react-native';

const { WindowBackgroundModule } = NativeModules;

export const WindowBackground = {
  setTheme(theme: string) {
    if (Platform.OS === 'ios' && WindowBackgroundModule) {
      WindowBackgroundModule.setTheme(theme);
    }
  },
};
