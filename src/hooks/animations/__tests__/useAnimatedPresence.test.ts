'use no memo';

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(),
  runOnRuntime: jest.fn(),
  useWorklet: jest.fn(),
  scheduleOnRN: jest.fn((fn: Function, ...args: any[]) => {
    fn(...args);
  }),
}));

import { renderHook, act } from '@testing-library/react-native';
import { useAnimatedPresence } from '../useAnimatedPresence';

describe('useAnimatedPresence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default state when no props are passed', () => {
    const { result } = renderHook(() => useAnimatedPresence());

    expect(result.current.shouldRender).toBe(false);
    expect(result.current.isVisible.value).toBe(false);
    expect(result.current.progress.value).toBe(0);
  });

  it('respects initialVisible=true', () => {
    const { result } = renderHook(() =>
      useAnimatedPresence({ initialVisible: true }),
    );

    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isVisible.value).toBe(true);
    expect(result.current.progress.value).toBe(1);
  });

  it('open function is callable', () => {
    const { result } = renderHook(() => useAnimatedPresence());

    // open should not throw
    expect(() => {
      act(() => {
        result.current.open();
      });
    }).not.toThrow();
  });

  it('open is a no-op when already visible', () => {
    const { result } = renderHook(() =>
      useAnimatedPresence({ initialVisible: true }),
    );

    // Already visible, open should not throw or change state
    act(() => {
      result.current.open();
    });

    expect(result.current.isVisible.value).toBe(true);
    expect(result.current.progress.value).toBe(1);
  });

  it('close does not change state when already hidden', () => {
    const { result } = renderHook(() => useAnimatedPresence());

    act(() => {
      result.current.close();
    });

    expect(result.current.isVisible.value).toBe(false);
    expect(result.current.progress.value).toBe(0);
  });

  it('close on visible sets isVisible to false and progress to 0', () => {
    const { result } = renderHook(() =>
      useAnimatedPresence({ initialVisible: true }),
    );

    act(() => {
      result.current.close();
    });

    expect(result.current.isVisible.value).toBe(false);
    // withSpring mock returns toValue directly
    expect(result.current.progress.value).toBe(0);
  });

  it('toggle is callable without error', () => {
    const { result } = renderHook(() => useAnimatedPresence());

    expect(() => {
      act(() => {
        result.current.toggle();
      });
    }).not.toThrow();
  });

  it('isActive returns false when initially hidden', () => {
    const { result } = renderHook(() => useAnimatedPresence());

    expect(result.current.isActive()).toBe(false);
  });

  it('isActive returns true when initialVisible is true', () => {
    const { result } = renderHook(() =>
      useAnimatedPresence({ initialVisible: true }),
    );

    expect(result.current.isActive()).toBe(true);
  });

  it('accepts custom spring config', () => {
    const customConfig = { mass: 1, damping: 20, stiffness: 200 };
    const { result } = renderHook(() =>
      useAnimatedPresence({ springConfig: customConfig }),
    );

    // Should initialize without error
    expect(result.current.shouldRender).toBe(false);
  });
});
