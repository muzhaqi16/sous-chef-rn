import { renderHook } from '@testing-library/react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { useBottomSheetBackdropClaim } from '../useBottomSheetBackdropClaim';

// The hook reads claim/release off the overlay provider. We mock just that
// hook so we can assert on the exact claim/release call sequence the sheet
// drives — this test is about WHEN the slot is claimed/released, not about
// the provider's internal SharedValue bookkeeping (covered by
// OverlayBackdropProvider.test.tsx).
// Each claim gets a distinct id so an assertion can name WHICH slot was
// released — a release aimed at a superseded claim is otherwise invisible.
let claimCount = 0;
const mockClaim = jest.fn(() => `claim-${++claimCount}`);
const mockRelease = jest.fn();

jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useOverlayBackdropOptional: () => ({
    claim: mockClaim,
    release: mockRelease,
  }),
}));

// Capture the release reaction's `react` callback so tests can simulate the
// sheet's `animatedIndex` settling at the closed anchor (-1). That reaction is
// the BACKSTOP release for interrupted closes; the primary, reliable release for
// a BottomSheetModal is gorhom's `onChange(-1)` (asserted separately below).
// `scheduleOnRN` is auto-mocked to invoke its function synchronously
// (__mocks__/react-native-worklets.js).
let reactToClose:
  | ((closed: boolean, previous: boolean | null) => void)
  | undefined;

beforeEach(() => {
  claimCount = 0;
  mockClaim.mockClear();
  mockRelease.mockClear();
  reactToClose = undefined;
  (useAnimatedReaction as jest.Mock).mockImplementation((_prepare, react) => {
    reactToClose = react;
  });
});

/**
 * Drive the release reaction with an explicit input pair.
 *
 * The reaction releases only on the open → closed TRANSITION — `closed` true
 * with `previous` false. Reanimated also invokes it with `previous === null`
 * (first run) and can re-invoke it while already closed (`previous === true`),
 * and the sheet reopening arrives as `closed === false`. Driving only the
 * transition would leave the `previous === false` guard and its absence
 * indistinguishable, so every input the signature admits is driven below.
 */
const driveReaction = (closed: boolean, previous: boolean | null) =>
  reactToClose?.(closed, previous);

/** Simulate `animatedIndex` settling at the closed anchor (open → closed). */
const driveClose = () => driveReaction(true, false);

describe('useBottomSheetBackdropClaim', () => {
  const makeRef = () => ({ current: { dismiss: jest.fn() } });

  it('claims at the START of the open animation via onAnimate(toIndex >= 0)', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    // gorhom fires onAnimate before it begins driving animatedPosition.
    result.current.onAnimate(-1, 0);

    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('does not double-claim when onChange(open) follows onAnimate(open)', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // open start
    result.current.onChange(0); // open settle (idempotent backstop)

    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('claims via the onChange backstop when onAnimate is skipped', () => {
    // gorhom suppresses onAnimate when toIndex === currentIndex (a present()
    // while already open). The onChange(index >= 0) backstop must still claim.
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onChange(0);

    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('does NOT release on onAnimate(toIndex === -1) (close start)', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim
    result.current.onAnimate(0, -1); // close START — must keep the dim through the ramp-down

    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('releases on the settled-closed onChange(-1) — the reliable modal path', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim
    result.current.onChange(-1); // settled closed → release

    expect(mockRelease).toHaveBeenCalledWith('claim-1');
  });

  it('also releases via the animatedIndex backstop (interrupted closes)', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim
    driveClose(); // SV reaches -1 without an onChange(-1) callback

    expect(mockRelease).toHaveBeenCalledWith('claim-1');
  });

  it.each([
    ['the reaction runs for the first time', true, null],
    ['the sheet is re-evaluated while already closed', true, true],
    ['the sheet is open', false, true],
  ] as const)('holds the claim when %s', (_case, closed, previous) => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim
    driveReaction(closed, previous);

    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('does not release the re-opened slot when the reaction re-fires while closed', () => {
    // The stale-release race the `previous === false` guard exists for: the
    // sheet closes and releases, then reopens onto a FRESH slot. A reaction
    // re-firing while `animatedIndex` is still parked at the closed anchor
    // must not tear down the new claim, or the reopened sheet loses its dim.
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim-1
    driveClose(); // release claim-1
    expect(mockRelease).toHaveBeenCalledWith('claim-1');

    result.current.onAnimate(-1, 0); // re-open → claim-2
    mockRelease.mockClear();
    driveReaction(true, true); // stale re-fire against the live claim

    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('treats a snap 0 -> 1 (multi-detent expand) as a no-op (already claimed)', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim
    result.current.onAnimate(0, 1); // expand to a larger snap point — still >= 0

    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('re-claims a fresh slot after a full close (refocus / re-open)', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0);
    driveClose(); // settled closed → release
    expect(mockRelease).toHaveBeenCalledTimes(1);

    mockClaim.mockClear();
    result.current.onAnimate(-1, 0); // re-open
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('defensively releases the held claim on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useBottomSheetBackdropClaim(makeRef()),
    );

    result.current.onAnimate(-1, 0);
    unmount();

    expect(mockRelease).toHaveBeenCalledWith('claim-1');
  });

  it('exposes animatedIndex, onChange, onAnimate and release', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    expect(result.current.animatedIndex).toBeDefined();
    expect(typeof result.current.onChange).toBe('function');
    expect(typeof result.current.onAnimate).toBe('function');
    expect(typeof result.current.release).toBe('function');
  });

  // `release` is for a caller that already knows the sheet is going away — a
  // modal dismiss can unmount the portal before onChange(-1) or onDismiss reach
  // JS, and a slot left claimed is an invisible full-screen tap blocker.
  it('releases the held claim on demand', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));
    result.current.onAnimate(-1, 0);

    result.current.release();

    expect(mockRelease).toHaveBeenCalledWith('claim-1');
  });

  it('ignores a release when no claim is held', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.release();
    result.current.release();

    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('keeps a stable release identity across renders', () => {
    const { result, rerender } = renderHook(() =>
      useBottomSheetBackdropClaim(makeRef()),
    );
    const first = result.current.release;

    rerender({});

    expect(result.current.release).toBe(first);
  });

  it('re-claims after a release, and releases the new slot', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));
    result.current.onAnimate(-1, 0);
    result.current.release();

    result.current.onAnimate(-1, 0);
    result.current.release();

    expect(mockRelease).toHaveBeenNthCalledWith(1, 'claim-1');
    expect(mockRelease).toHaveBeenNthCalledWith(2, 'claim-2');
  });
});
