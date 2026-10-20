import { UnistylesRuntime } from 'react-native-unistyles';
import { ThemePreference } from '#store/slices/preferenceTypes';
import { applyThemeToRuntime } from '../applyAppearance';

const runtime = jest.mocked(UnistylesRuntime);

beforeEach(() => jest.clearAllMocks());

describe('applyThemeToRuntime', () => {
  it('follows the device for the system preference', () => {
    applyThemeToRuntime(ThemePreference.SYSTEM);

    expect(runtime.setAdaptiveThemes).toHaveBeenCalledWith(true);
    expect(runtime.setTheme).not.toHaveBeenCalled();
  });

  it('pins dark, leaving adaptive themes off', () => {
    applyThemeToRuntime(ThemePreference.DARK);

    expect(runtime.setAdaptiveThemes).toHaveBeenCalledWith(false);
    expect(runtime.setTheme).toHaveBeenCalledWith('dark');
  });
});
