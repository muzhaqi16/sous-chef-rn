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
    // end every slide inside triggerSlide. These tests assert on the
    // mid-animation state, so suppress the synchronous callback.
    (withTiming as jest.Mock).mockImplementation(toValue => toValue);
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
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('triggerSlide does nothing for left direction when allowedDirections is right', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1', allowedDirections: 'right' }),
    );

    act(() => {
      result.current.triggerSlide(-1, onComplete);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('triggerSlide does nothing for right direction when allowedDirections is left', () => {
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1', allowedDirections: 'left' }),
    );

    act(() => {
      result.current.triggerSlide(1);
    });

    expect(withTiming).not.toHaveBeenCalled();
  });

  it('a second triggerSlide mid-animation does not restart the slide', () => {
    const { result } = renderHook(() =>
      useSlideAnimation({ itemId: 'item-1' }),
    );

    act(() => {
      result.current.triggerSlide(1);
    });
    act(() => {
      result.current.triggerSlide(1);
    });

    expect(withTiming).toHaveBeenCalledTimes(1);
  });

  it('a recycled view can slide again (itemId change resets the slide)', () => {
    const { result, rerender } = renderHook(
      ({ itemId }: { itemId: string }) => useSlideAnimation({ itemId }),
      { initialProps: { itemId: 'item-1' } },
    );

    act(() => {
      result.current.triggerSlide(1);
    });
    expect(withTiming).toHaveBeenCalledTimes(1);

    rerender({ itemId: 'item-2' });
    act(() => {
      result.current.triggerSlide(1);
    });

    expect(withTiming).toHaveBeenCalledTimes(2);
  });
});
