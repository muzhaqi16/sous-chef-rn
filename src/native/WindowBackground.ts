import { nativeMethod } from './nativeModule';

export const WindowBackground = {
  setTheme(theme: string) {
    nativeMethod('WindowBackgroundModule', 'setTheme')?.(theme);
  },
};
