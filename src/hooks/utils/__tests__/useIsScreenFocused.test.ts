import { act, renderHook } from '@testing-library/react-native';
import { memoryScreen } from '#/test-utils/memoryPlatform';
import { useIsScreenFocused } from '../useIsScreenFocused';

describe('useIsScreenFocused', () => {
  afterEach(() => {
    act(() => memoryScreen().setFocused(true));
  });

  it('starts focused', () => {
    const { result } = renderHook(() => useIsScreenFocused());
    expect(result.current).toBe(true);
  });

  it('follows the screen through a blur and back', () => {
    const { result } = renderHook(() => useIsScreenFocused());

    act(() => memoryScreen().setFocused(false));
    expect(result.current).toBe(false);

    act(() => memoryScreen().setFocused(true));
    expect(result.current).toBe(true);
  });
});
