import { renderHook, act } from '@testing-library/react-native';
import { useSwipeableCoordinator } from '../useSwipeableCoordinator';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSwipeableCoordinator', () => {
  const createMockSwipeableRef = () => ({
    current: { close: jest.fn() },
  });

  it('returns handleSwipeableWillOpen and handleSwipeableClose', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());

    expect(result.current.handleSwipeableWillOpen).toBeInstanceOf(Function);
    expect(result.current.handleSwipeableClose).toBeInstanceOf(Function);
  });

  it('does not throw when opening the first swipeable (no previous one)', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());
    const ref = createMockSwipeableRef();

    expect(() => {
      act(() => {
        result.current.handleSwipeableWillOpen(ref);
      });
    }).not.toThrow();
  });

  it('closes the previously open swipeable when a different one opens', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());
    const ref1 = createMockSwipeableRef();
    const ref2 = createMockSwipeableRef();

    act(() => {
      result.current.handleSwipeableWillOpen(ref1);
    });

    act(() => {
      result.current.handleSwipeableWillOpen(ref2);
    });

    // ref1 should have been closed
    expect(ref1.current.close).toHaveBeenCalledTimes(1);
    // ref2 should not have been closed
    expect(ref2.current.close).not.toHaveBeenCalled();
  });

  it('does not close the same swipeable if it is re-opened', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());
    const ref1 = createMockSwipeableRef();

    act(() => {
      result.current.handleSwipeableWillOpen(ref1);
    });

    act(() => {
      result.current.handleSwipeableWillOpen(ref1);
    });

    // Same ref, should not call close
    expect(ref1.current.close).not.toHaveBeenCalled();
  });

  it('handleSwipeableClose clears the tracked ref', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());
    const ref1 = createMockSwipeableRef();
    const ref2 = createMockSwipeableRef();

    // Open ref1, then close it
    act(() => {
      result.current.handleSwipeableWillOpen(ref1);
    });
    act(() => {
      result.current.handleSwipeableClose();
    });

    // Now opening ref2 should NOT close ref1 (since the tracker was cleared)
    act(() => {
      result.current.handleSwipeableWillOpen(ref2);
    });

    expect(ref1.current.close).not.toHaveBeenCalled();
  });

  it('handles three sequential swipeable opens correctly', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());
    const ref1 = createMockSwipeableRef();
    const ref2 = createMockSwipeableRef();
    const ref3 = createMockSwipeableRef();

    act(() => {
      result.current.handleSwipeableWillOpen(ref1);
    });

    act(() => {
      result.current.handleSwipeableWillOpen(ref2);
    });
    expect(ref1.current.close).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleSwipeableWillOpen(ref3);
    });
    expect(ref2.current.close).toHaveBeenCalledTimes(1);
    // ref3 is now the tracked one
    expect(ref3.current.close).not.toHaveBeenCalled();
  });

  it('handles swipeable ref with no current (null current)', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());
    const refWithNullCurrent = { current: null };
    const ref2 = createMockSwipeableRef();

    act(() => {
      result.current.handleSwipeableWillOpen(refWithNullCurrent);
    });

    // Opening ref2 should try to close refWithNullCurrent but not throw
    expect(() => {
      act(() => {
        result.current.handleSwipeableWillOpen(ref2);
      });
    }).not.toThrow();
  });

  it('close followed by open does not affect new swipeable', () => {
    const { result } = renderHook(() => useSwipeableCoordinator());
    const ref1 = createMockSwipeableRef();

    act(() => {
      result.current.handleSwipeableClose();
    });

    act(() => {
      result.current.handleSwipeableWillOpen(ref1);
    });

    // Nothing should have been closed since we cleared before opening
    expect(ref1.current.close).not.toHaveBeenCalled();
  });
});
