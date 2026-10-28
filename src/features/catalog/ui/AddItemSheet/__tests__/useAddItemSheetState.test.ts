'use no memo';
import { renderHook } from '@testing-library/react-native';
import { useAddItemSheetState } from '../useAddItemSheetState';

// Mock requestAnimationFrame and requestIdleCallback
global.requestAnimationFrame = (cb: (time: number) => void) => {
  cb(0);
  return 0;
};
global.cancelAnimationFrame = jest.fn();
global.requestIdleCallback = (cb: IdleRequestCallback) => {
  cb({ didTimeout: false, timeRemaining: () => 0 });
  return 0;
};
global.cancelIdleCallback = jest.fn();

describe('useAddItemSheetState', () => {
  it('returns initial state when not visible', () => {
    const { result } = renderHook(() =>
      useAddItemSheetState({ visible: false, contextId: undefined }),
    );
    expect(result.current.searchQuery).toBe('');
  });

  it('enables shouldFetch when visible with contextId', () => {
    const { result } = renderHook(() =>
      useAddItemSheetState({ visible: true, contextId: 'ctx-1' }),
    );
    expect(result.current.shouldFetch).toBe(true);
  });
});
