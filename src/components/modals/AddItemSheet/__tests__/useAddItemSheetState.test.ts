'use no memo';
import { renderHook, act } from '@testing-library/react-native';
import { useAddItemSheetState } from '../useAddItemSheetState';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));

// Mock requestAnimationFrame and requestIdleCallback
global.requestAnimationFrame = ((cb: () => void) => { cb(); return 0; }) as any;
global.cancelAnimationFrame = jest.fn();
global.requestIdleCallback = ((cb: () => void) => { cb(); return 0; }) as any;
global.cancelIdleCallback = jest.fn();

describe('useAddItemSheetState', () => {
  it('returns initial state when not visible', () => {
    const { result } = renderHook(() =>
      useAddItemSheetState({ visible: false, contextId: undefined }),
    );
    expect(result.current.searchQuery).toBe('');
    expect(result.current.showSearchResults).toBe(false);
    expect(result.current.showSuggestions).toBe(true);
  });

  it('enables shouldFetch when visible with contextId', () => {
    const { result } = renderHook(() =>
      useAddItemSheetState({ visible: true, contextId: 'ctx-1' }),
    );
    expect(result.current.shouldFetch).toBe(true);
  });

  it('shows search results when query >= 2 characters', () => {
    const { result } = renderHook(() =>
      useAddItemSheetState({ visible: true, contextId: 'ctx-1' }),
    );
    act(() => result.current.setSearchQuery('mi'));
    expect(result.current.showSearchResults).toBe(true);
    expect(result.current.showSuggestions).toBe(false);
  });

  it('manages exit animations', () => {
    const { result } = renderHook(() =>
      useAddItemSheetState({ visible: true, contextId: 'ctx-1' }),
    );
    act(() => result.current.startExitAnimation('item-1'));
    expect(result.current.exitingItems.has('item-1')).toBe(true);
    act(() => result.current.completeExitAnimation('item-1'));
    expect(result.current.exitingItems.has('item-1')).toBe(false);
  });
});
