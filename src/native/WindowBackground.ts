import { NativeModules, Platform } from 'react-native';

const { WindowBackgroundModule } = NativeModules;

export const WindowBackground = {
  setBackgroundColor(hex: string) {
    if (Platform.OS === 'ios' && WindowBackgroundModule) {
      WindowBackgroundModule.setBackgroundColor(hex);
    }
  },
};
