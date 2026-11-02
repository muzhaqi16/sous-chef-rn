import { nativeMethod } from './nativeModule';

const MODULE = 'WindowBackgroundModule';

export const WindowBackground = {
  /**
   * `theme` colours Android's navigation bar buttons. iOS has a `followSystem`
   * instead while the app follows the OS: a style on its window hides the OS's
   * changes from the app, and Unistyles reads it as the OS's colour scheme.
   */
  setTheme(theme: string, followsSystem: boolean) {
    const followSystem = followsSystem
      ? nativeMethod(MODULE, 'followSystem')
      : null;
    if (followSystem) {
      followSystem();
      return;
    }
    nativeMethod(MODULE, 'setTheme')?.(theme);
  },
};
