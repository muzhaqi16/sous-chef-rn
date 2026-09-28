import { act, renderHook } from '@testing-library/react-native';
import { useMotionEnabled } from '../useMotionEnabled';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useRowReflow } from '../useRowReflow';

jest.mock('../useMotionEnabled');
const mockUseMotionEnabled = jest.mocked(useMotionEnabled);

const scrollEvent = {
  nativeEvent: { contentOffset: { y: 0 } },
} as NativeSyntheticEvent<NativeScrollEvent>;

const setup = (onScrollBeginDrag?: () => void) => {
  const order: string[] = [];
  const prepareForLayoutAnimationRender = jest.fn(() => {
    order.push('prepare');
  });
  const listRef = { current: { prepareForLayoutAnimationRender } };
  // What each render produced: `result.current` publishes in renderHook's own
  // effect, which runs AFTER the hook's, so it lags inside a removal.
  const rendered: boolean[] = [];
  const hook = renderHook(() => {
    const reflow = useRowReflow(listRef, onScrollBeginDrag);
    rendered.push(reflow.reflowing);
    return reflow;
  });
  return { hook, order, rendered };
};

describe('useRowReflow', () => {
  beforeEach(() => {
    mockUseMotionEnabled.mockReturnValue(true);
  });

  it('attaches the transition a commit before the removal runs', () => {
    const { hook, rendered } = setup();
    const reflowingWhenCommitted: (boolean | undefined)[] = [];
    const commit = jest.fn(() => {
      reflowingWhenCommitted.push(rendered.at(-1));
    });

    act(() => {
      hook.result.current.removeRow(commit);
      expect(commit).not.toHaveBeenCalled();
    });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(reflowingWhenCommitted).toEqual([true]);
  });

  it('prepares FlashList before running the removal', () => {
    const { hook, order } = setup();

    act(() => {
      hook.result.current.removeRow(() => order.push('commit'));
    });

    expect(order).toEqual(['prepare', 'commit']);
  });

  it('runs every removal requested in one tick', () => {
    const { hook } = setup();
    const first = jest.fn();
    const second = jest.fn();

    act(() => {
      hook.result.current.removeRow(first);
      hook.result.current.removeRow(second);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('detaches the transition once the reflow has had time to finish', () => {
    jest.useFakeTimers();
    try {
      const { hook } = setup();

      act(() => {
        hook.result.current.removeRow(jest.fn());
      });
      expect(hook.result.current.reflowing).toBe(true);

      act(() => {
        jest.runOnlyPendingTimers();
      });
      expect(hook.result.current.reflowing).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('detaches at once when a drag starts, without dropping the removal', () => {
    const onScrollBeginDrag = jest.fn();
    const { hook } = setup(onScrollBeginDrag);
    const commit = jest.fn();

    act(() => {
      hook.result.current.removeRow(commit);
    });
    act(() => {
      hook.result.current.onScrollBeginDrag?.(scrollEvent);
    });

    expect(hook.result.current.reflowing).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
    // The list's own drag handler still runs.
    expect(onScrollBeginDrag).toHaveBeenCalledTimes(1);
  });

  it('runs a removal exactly once when the list unmounts right after it', () => {
    const { hook } = setup();
    const commit = jest.fn();

    act(() => {
      hook.result.current.removeRow(commit);
    });
    hook.unmount();

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('removes at once and never attaches the transition under reduce motion', () => {
    mockUseMotionEnabled.mockReturnValue(false);
    const { hook, order } = setup();

    act(() => {
      hook.result.current.removeRow(() => order.push('commit'));
      expect(order).toEqual(['prepare', 'commit']);
    });

    expect(hook.result.current.reflowing).toBe(false);
  });
});
