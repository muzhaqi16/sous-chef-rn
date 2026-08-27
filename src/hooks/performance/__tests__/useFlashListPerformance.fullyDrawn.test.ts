/**
 * The fully-drawn latch: WHEN `app_fully_drawn_ms` is allowed to fire.
 *
 * FlashList reports `onLoad` as soon as every visible index has been measured,
 * and a skeleton state that hands the list one sticky-header sentinel satisfies
 * that immediately. Keying first-meaningful-paint off `onLoad` alone therefore
 * timed the chrome. These tests hold that gate shut.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useFlashListPerformance } from '../useFlashListPerformance';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';

jest.mock('#/services/telemetry', () => ({
  Telemetry: { histogram: jest.fn(), increment: jest.fn() },
}));

jest.mock('#/services/performance/NativePerformanceService', () => ({
  NativePerformanceService: { markFullyDrawn: jest.fn() },
}));

const markFullyDrawn = NativePerformanceService.markFullyDrawn as jest.Mock;

/** Render the hook with a given content state, returning a rerender helper. */
const renderWithContent = (
  hasRealContent: boolean,
  onFirstContentLayout?: () => void,
) => {
  const ref = { current: null };
  return renderHook(
    (props: { hasRealContent: boolean }) =>
      useFlashListPerformance(ref, {
        componentName: 'TestList',
        reportInterval: 0,
        hasRealContent: props.hasRealContent,
        onFirstContentLayout,
      }),
    { initialProps: { hasRealContent } },
  );
};

describe('useFlashListPerformance — the fully-drawn latch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not latch on a layout that completed over placeholders', () => {
    // The Pantry's skeleton state: one sentinel row, zero items. FlashList
    // measures it instantly and reports onLoad, but nothing a user would call
    // content is on screen.
    const { result } = renderWithContent(false);

    act(() => result.current.onLoad({ elapsedTimeInMs: 12 }));

    expect(markFullyDrawn).not.toHaveBeenCalled();
  });

  it('latches on the first commit where real content is present', () => {
    const { result, rerender } = renderWithContent(false);

    act(() => result.current.onLoad({ elapsedTimeInMs: 12 }));
    expect(markFullyDrawn).not.toHaveBeenCalled();

    // Items arrive on a later commit — which is the whole reason the latch is
    // an effect over both inputs rather than a branch inside onLoad.
    rerender({ hasRealContent: true });

    expect(markFullyDrawn).toHaveBeenCalledTimes(1);
  });

  it('does not latch on content alone, before layout has finished', () => {
    // Content without a completed layout is not a painted frame.
    renderWithContent(true);

    expect(markFullyDrawn).not.toHaveBeenCalled();
  });

  it('latches when layout finishes on a list that already had content', () => {
    const { result } = renderWithContent(true);

    act(() => result.current.onLoad({ elapsedTimeInMs: 12 }));

    expect(markFullyDrawn).toHaveBeenCalledTimes(1);
  });

  it('does not re-latch on later content changes', () => {
    // markFullyDrawn is one-shot itself, but calling it repeatedly from here
    // would hide a real ordering bug behind that guard.
    const { result, rerender } = renderWithContent(true);
    act(() => result.current.onLoad({ elapsedTimeInMs: 12 }));

    rerender({ hasRealContent: false });
    rerender({ hasRealContent: true });

    expect(markFullyDrawn).toHaveBeenCalledTimes(1);
  });
});

describe('useFlashListPerformance — the first-content-layout latch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not latch on a commit that laid out only placeholders', () => {
    // The sentinel-only skeleton layout runs a full commitLayout too — that
    // commit fires onCommitLayoutEffect, but nothing on it is content, and a
    // skeleton overlay released on it would expose the blank window.
    const { result } = renderWithContent(false);

    act(() => result.current.onCommitLayoutEffect());

    expect(result.current.hasContentLayout).toBe(false);
  });

  it('latches on the first commit that lands with real content', () => {
    const onFirstContentLayout = jest.fn();
    const { result, rerender } = renderWithContent(false, onFirstContentLayout);

    act(() => result.current.onCommitLayoutEffect());
    rerender({ hasRealContent: true });
    act(() => result.current.onCommitLayoutEffect());

    expect(result.current.hasContentLayout).toBe(true);
    expect(onFirstContentLayout).toHaveBeenCalledTimes(1);
  });

  it('is one-shot: later commits do not re-fire the callback', () => {
    // FlashList re-fires onCommitLayoutEffect on every stable layout commit;
    // an un-guarded setState there is the upstream-documented loop.
    const onFirstContentLayout = jest.fn();
    const { result } = renderWithContent(true, onFirstContentLayout);

    act(() => result.current.onCommitLayoutEffect());
    act(() => result.current.onCommitLayoutEffect());
    act(() => result.current.onCommitLayoutEffect());

    expect(result.current.hasContentLayout).toBe(true);
    expect(onFirstContentLayout).toHaveBeenCalledTimes(1);
  });

  it('does not disturb the fully-drawn latch', () => {
    // The two latches ride different signals (commit layout vs onLoad) and
    // must stay independent: fully-drawn fires from onLoad + content alone.
    const { result } = renderWithContent(true);

    act(() => result.current.onCommitLayoutEffect());
    expect(markFullyDrawn).not.toHaveBeenCalled();

    act(() => result.current.onLoad({ elapsedTimeInMs: 12 }));
    expect(markFullyDrawn).toHaveBeenCalledTimes(1);
  });
});
