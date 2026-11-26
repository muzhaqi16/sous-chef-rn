import { Appearance, NativeModules, Platform } from 'react-native';
import { WindowBackground } from '../WindowBackground';

const nativeModules = NativeModules as Record<string, unknown>;

afterEach(() => {
  delete nativeModules.WindowBackgroundModule;
  jest.restoreAllMocks();
});

describe('WindowBackground on iOS', () => {
  it('leaves the window unstyled while following the system', () => {
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');

    WindowBackground.setTheme('dark', true);

    expect(setColorScheme).toHaveBeenCalledWith('auto');
  });

  it('styles the window with a chosen theme', () => {
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');

    WindowBackground.setTheme('dark', false);

    expect(setColorScheme).toHaveBeenCalledWith('dark');
  });
});

describe('WindowBackground on Android', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it('hands the resolved theme to the navigation bar, following the system or not', () => {
    const setTheme = jest.fn();
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');
    nativeModules.WindowBackgroundModule = { setTheme };

    WindowBackground.setTheme('dark', true);

    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(setColorScheme).not.toHaveBeenCalled();
  });

  it('does nothing where the app has no module', () => {
    expect(() => WindowBackground.setTheme('dark', true)).not.toThrow();
  });
});
