import { NativeModules } from 'react-native';
import { WindowBackground } from '../WindowBackground';

const nativeModules = NativeModules as Record<string, unknown>;

afterEach(() => {
  delete nativeModules.WindowBackgroundModule;
});

describe('WindowBackground', () => {
  it('leaves the window unstyled while following the system, where it can', () => {
    const setTheme = jest.fn();
    const followSystem = jest.fn();
    nativeModules.WindowBackgroundModule = { setTheme, followSystem };

    WindowBackground.setTheme('dark', true);

    expect(followSystem).toHaveBeenCalledTimes(1);
    expect(setTheme).not.toHaveBeenCalled();
  });

  it('pins a chosen theme', () => {
    const setTheme = jest.fn();
    const followSystem = jest.fn();
    nativeModules.WindowBackgroundModule = { setTheme, followSystem };

    WindowBackground.setTheme('dark', false);

    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(followSystem).not.toHaveBeenCalled();
  });

  it('still hands the resolved theme to a platform with nothing to unpin', () => {
    const setTheme = jest.fn();
    nativeModules.WindowBackgroundModule = { setTheme };

    WindowBackground.setTheme('dark', true);

    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('does nothing where the app has no module', () => {
    expect(() => WindowBackground.setTheme('dark', true)).not.toThrow();
  });
});
