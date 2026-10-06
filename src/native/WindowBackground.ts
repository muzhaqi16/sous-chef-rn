import { Platform } from 'react-native';
import { nativeMethod } from './nativeModule';

export const WindowBackground = {
  setTheme(theme: string) {
    if (Platform.OS === 'ios') {
      nativeMethod('WindowBackgroundModule', 'setTheme')?.(theme);
    }
  },
};
