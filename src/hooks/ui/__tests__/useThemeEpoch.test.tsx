import { act, renderHook } from '@testing-library/react-native';
import { StyleSheet, UnistyleDependency } from 'react-native-unistyles';
import { useThemeEpoch } from '../useThemeEpoch';

type ChangeListener = (dependencies: UnistyleDependency[]) => void;

const addChangeListener = jest.mocked(StyleSheet.addChangeListener);

let emitChange: ChangeListener;

beforeAll(() => {
  // The module registers its one Unistyles listener on first read.
  renderHook(() => useThemeEpoch()).unmount();
  const [registration] = addChangeListener.mock.calls;
  if (!registration) throw new Error('useThemeEpoch registered no listener');
  emitChange = registration[0];
});

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
