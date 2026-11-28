import { Appearance, Platform } from 'react-native';
import { nativeMethod } from './nativeModule';

const MODULE = 'WindowBackgroundModule';

export const WindowBackground = {
  /**
   * iOS styles the window, so system UI matches the app; following the OS it
   * clears the style, which would hide the OS's changes from Unistyles.
   * Android colours its navigation bar's buttons.
   */
  setTheme(theme: 'light' | 'dark', followsSystem: boolean) {
    if (Platform.OS === 'ios') {
      Appearance.setColorScheme(followsSystem ? 'auto' : theme);
      return;
    }
    nativeMethod(MODULE, 'setTheme')?.(theme);
  },
};
