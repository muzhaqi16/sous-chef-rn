import React, { Activity } from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import {
  StyleSheet,
  UnistyleDependency,
  UnistylesRuntime,
} from 'react-native-unistyles';
import { useThemeEpoch, useThemeResyncOnReveal } from '../useThemeEpoch';

type ChangeListener = (dependencies: UnistyleDependency[]) => void;

const addChangeListener = jest.mocked(StyleSheet.addChangeListener);
const updateTheme = jest.mocked(UnistylesRuntime.updateTheme);

let emitChange: ChangeListener;

beforeAll(() => {
  // The module registers its one Unistyles listener on first read.
  renderHook(() => useThemeEpoch()).unmount();
  const [registration] = addChangeListener.mock.calls;
  if (!registration) throw new Error('useThemeEpoch registered no listener');
  emitChange = registration[0];
});

beforeEach(() => {
  updateTheme.mockClear();
});

// The resync is queued as a microtask, so wait for one inside `act`.
const flushMicrotasks = () =>
  act(() => new Promise<void>(resolve => queueMicrotask(resolve)));

const Probe = () => {
  useThemeResyncOnReveal();
  return null;
};

const renderInActivity = (mode: 'visible' | 'hidden') => (
  <Activity mode={mode}>
    <Probe />
  </Activity>
);

describe('useThemeEpoch', () => {
  it('bumps on a theme commit and ignores other dependencies', () => {
    const { result } = renderHook(() => useThemeEpoch());
    const before = result.current;

    act(() => emitChange([UnistyleDependency.Insets]));
    expect(result.current).toBe(before);

    act(() => emitChange([UnistyleDependency.Theme]));
    expect(result.current).toBe(before + 1);
  });

  it('registers a single Unistyles listener however many readers', () => {
    renderHook(() => useThemeEpoch());
    renderHook(() => useThemeEpoch());

    expect(addChangeListener).toHaveBeenCalledTimes(1);
  });
});

describe('useThemeResyncOnReveal', () => {
  it('replays a theme change that landed while the screen was paused', async () => {
    const { rerender } = render(renderInActivity('visible'));
    rerender(renderInActivity('hidden'));

    act(() => emitChange([UnistyleDependency.Theme]));
    rerender(renderInActivity('visible'));
    await flushMicrotasks();

    expect(updateTheme).toHaveBeenCalledTimes(1);
    const [call] = updateTheme.mock.calls;
    if (!call) throw new Error('no resync');
    const [themeName, updater] = call;
    expect(themeName).toBe(UnistylesRuntime.themeName);
    const theme = UnistylesRuntime.getTheme();
    expect(updater(theme)).toBe(theme);
  });

  it('does nothing when the theme did not change while paused', async () => {
    const { rerender } = render(renderInActivity('visible'));
    rerender(renderInActivity('hidden'));
    rerender(renderInActivity('visible'));
    await flushMicrotasks();

    expect(updateTheme).not.toHaveBeenCalled();
  });

  it('does nothing on the first mount, whatever changed before it', async () => {
    act(() => emitChange([UnistyleDependency.Theme]));
    render(renderInActivity('visible'));
    await flushMicrotasks();

    expect(updateTheme).not.toHaveBeenCalled();
  });
});
