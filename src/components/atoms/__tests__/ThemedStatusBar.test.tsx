import React from 'react';
import { render } from '@testing-library/react-native';
import { WindowBackground } from '#/native/WindowBackground';
import { ThemePreference } from '#/store/slices/preferenceTypes';
import { ThemedStatusBar } from '../ThemedStatusBar';

let mockThemePreference = ThemePreference.SYSTEM;

jest.mock('#/native/WindowBackground', () => ({
  WindowBackground: { setTheme: jest.fn() },
}));
jest.mock('#store/useAppStore', () => ({
  useIsHydrated: () => true,
  useTheme: () => mockThemePreference,
}));

const setWindowTheme = jest.mocked(WindowBackground.setTheme);

beforeEach(() => {
  setWindowTheme.mockClear();
});

describe('ThemedStatusBar', () => {
  it('lets the window follow the system on the system preference', () => {
    mockThemePreference = ThemePreference.SYSTEM;

    render(<ThemedStatusBar />);

    expect(setWindowTheme).toHaveBeenLastCalledWith('light', true);
  });

  it('pins the window to a chosen theme', () => {
    mockThemePreference = ThemePreference.DARK;

    render(<ThemedStatusBar />);

    expect(setWindowTheme).toHaveBeenLastCalledWith('dark', false);
  });

  it('unpins the window even when the system resolves to the same theme', () => {
    mockThemePreference = ThemePreference.LIGHT;
    const { rerender } = render(<ThemedStatusBar />);
    expect(setWindowTheme).toHaveBeenLastCalledWith('light', false);

    mockThemePreference = ThemePreference.SYSTEM;
    rerender(<ThemedStatusBar />);

    expect(setWindowTheme).toHaveBeenLastCalledWith('light', true);
  });
});
