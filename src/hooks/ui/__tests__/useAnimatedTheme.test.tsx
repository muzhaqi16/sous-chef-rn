import React, { Activity } from 'react';
import { render } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';
import { UnistylesRuntime } from 'react-native-unistyles';
import { useAnimatedTheme as useUnistylesAnimatedTheme } from 'react-native-unistyles/reanimated';
import { darkTheme, lightTheme } from '#/theme/themes';
import { useAnimatedTheme } from '../useAnimatedTheme';

const getTheme = jest.mocked(UnistylesRuntime.getTheme);
const unistylesAnimatedTheme = jest.mocked(useUnistylesAnimatedTheme);

const Probe = () => {
  useAnimatedTheme();
  return null;
};

const renderInActivity = (mode: 'visible' | 'hidden') => (
  <Activity mode={mode}>
    <Probe />
  </Activity>
);

// Unistyles' own hook is mocked, so the value only moves when the app's does.
const mountWithLightTheme = () => {
  const animatedTheme = makeMutable(UnistylesRuntime.getTheme());
  unistylesAnimatedTheme.mockReturnValue(animatedTheme);
  return animatedTheme;
};

beforeEach(() => {
  getTheme.mockReturnValue(lightTheme);
});

describe('useAnimatedTheme', () => {
  it('re-reads a theme that changed while its screen was paused', () => {
    const animatedTheme = mountWithLightTheme();
    const { rerender } = render(renderInActivity('visible'));
    rerender(renderInActivity('hidden'));

    getTheme.mockReturnValue(darkTheme);
    rerender(renderInActivity('visible'));

    expect(animatedTheme.get()).toBe(darkTheme);
  });

  it('writes nothing when the theme did not change while paused', () => {
    const animatedTheme = mountWithLightTheme();
    const { rerender } = render(renderInActivity('visible'));
    rerender(renderInActivity('hidden'));
    rerender(renderInActivity('visible'));

    expect(animatedTheme.set).not.toHaveBeenCalled();
  });

  it('writes nothing on the first mount', () => {
    const animatedTheme = mountWithLightTheme();
    render(renderInActivity('visible'));

    expect(animatedTheme.set).not.toHaveBeenCalled();
  });
});
