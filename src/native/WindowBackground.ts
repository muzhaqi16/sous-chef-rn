import { NativeModules, Platform } from 'react-native';

interface WindowBackgroundNativeModule {
  setTheme: (theme: string) => void;
}

const isWindowBackgroundModule = (
  value: unknown,
): value is WindowBackgroundNativeModule =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'setTheme') === 'function';

const windowBackgroundModule: unknown = NativeModules.WindowBackgroundModule;

export const WindowBackground = {
  setTheme(theme: string) {
    if (
      Platform.OS === 'ios' &&
      isWindowBackgroundModule(windowBackgroundModule)
    ) {
      windowBackgroundModule.setTheme(theme);
    }
  },
};
