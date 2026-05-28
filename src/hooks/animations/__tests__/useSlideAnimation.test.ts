'use no memo';

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(),
  runOnRuntime: jest.fn(),
  useWorklet: jest.fn(),
  scheduleOnRN: jest.fn((fn: Function) => {
    fn();
  }),
}));

import { renderHook, act } from '@testing-library/react-native';
import { withTiming } from 'react-native-reanimated';
import { useSlideAnimation } from '../useSlideAnimation';

describe('useSlideAnimation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The global mock fires the completion callback synchronously, which would
    // immediately reset isAnimating to false inside triggerSlide. These tests
    // assert on the mid-animation state, so suppress the synchronous callback.
    (withTiming as jest.Mock).mockImplementation(toValue => toValue);
  });

  it('returns animatedSlideStyle, triggerSlide, resetSlide and isAnimating', () => {
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1' }),
    );

    expect(result.current).toHaveProperty('animatedSlideStyle');
    expect(result.current).toHaveProperty('triggerSlide');
    expect(result.current).toHaveProperty('resetSlide');
    expect(result.current).toHaveProperty('isAnimating');
  });

  it('isAnimating starts as false', () => {
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1' }),
    );

    expect(result.current.isAnimating.value).toBe(false);
  });

  it('triggerSlide calls onComplete immediately when disabled', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1', disabled: true }),
    );

    act(() => {
      result.current.triggerSlide(1, onComplete);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('triggerSlide does nothing for left direction when allowedDirections is right', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1', allowedDirections: 'right' }),
    );

    act(() => {
      result.current.triggerSlide(-1, onComplete);
    });

    // Should not call onComplete since the direction is blocked
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.isAnimating.value).toBe(false);
  });

  it('triggerSlide does nothing for right direction when allowedDirections is left', () => {
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1', allowedDirections: 'left' }),
    );

    act(() => {
      result.current.triggerSlide(1);
    });

    expect(result.current.isAnimating.value).toBe(false);
  });

  it('triggerSlide sets isAnimating to true', () => {
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1' }),
    );

    act(() => {
      result.current.triggerSlide(1);
    });

    expect(result.current.isAnimating.value).toBe(true);
  });

  it('resetSlide resets isAnimating to false', () => {
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1' }),
    );

    act(() => {
      result.current.triggerSlide(1);
    });
    expect(result.current.isAnimating.value).toBe(true);

    act(() => {
      result.current.resetSlide();
    });
    expect(result.current.isAnimating.value).toBe(false);
  });

  it('resets animation state when itemId changes (view recycling)', () => {
    const { result, rerender } = renderHook(
      ({ itemId }: any) => useSlideAnimation({ itemId }),
      { initialProps: { itemId: 'item-1' } },
    );

    act(() => {
      result.current.triggerSlide(1);
    });
    expect(result.current.isAnimating.value).toBe(true);

    // Rerender with a new itemId (simulating FlashList recycling)
    rerender({ itemId: 'item-2' });
    expect(result.current.isAnimating.value).toBe(false);
  });
});
