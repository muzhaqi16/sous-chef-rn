import { renderHook } from '@testing-library/react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { useBottomSheetBackdropClaim } from '../useBottomSheetBackdropClaim';

// The hook reads claim/release off the overlay provider. We mock just that
// hook so we can assert on the exact claim/release call sequence the sheet
// drives — this test is about WHEN the slot is claimed/released, not about
// the provider's internal SharedValue bookkeeping (covered by
// OverlayBackdropProvider.test.tsx).
const mockClaim = jest.fn(() => 'claim-id');
const mockRelease = jest.fn();

jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useOverlayBackdropOptional: () => ({
    claim: mockClaim,
    release: mockRelease,
  }),
}));

// Capture the release reaction's `react` callback so tests can simulate the
// sheet's `animatedIndex` settling at the closed anchor (-1) — which is what
// drives release in v3 (no longer gorhom's `onChange(-1)`). `scheduleOnRN` is
// auto-mocked to invoke its function synchronously
// (__mocks__/react-native-worklets.js).
let reactToClose:
  | ((closed: boolean, previous: boolean | null) => void)
  | undefined;

beforeEach(() => {
  mockClaim.mockClear().mockReturnValue('claim-id');
  mockRelease.mockClear();
  reactToClose = undefined;
  (useAnimatedReaction as jest.Mock).mockImplementation((_prepare, react) => {
    reactToClose = react;
  });
});

/** Simulate `animatedIndex` settling at the closed anchor (open → closed). */
const driveClose = () => reactToClose?.(true, false);

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

  it('does NOT release on onChange(-1) — release is SV-driven, not callback-driven', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim
    result.current.onChange(-1); // gorhom settled-closed callback no longer releases

    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('releases when animatedIndex settles at the closed anchor (-1)', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    result.current.onAnimate(-1, 0); // claim
    driveClose(); // SV crosses to -1 (reliable even when onChange(-1) is skipped)

    expect(mockRelease).toHaveBeenCalledWith('claim-id');
  });

  it('treats a snap 0 -> 1 (keyboardAware expand) as a no-op (already claimed)', () => {
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

    expect(mockRelease).toHaveBeenCalledWith('claim-id');
  });

  it('exposes animatedIndex, onChange and onAnimate', () => {
    const { result } = renderHook(() => useBottomSheetBackdropClaim(makeRef()));

    expect(result.current.animatedIndex).toBeDefined();
    expect(typeof result.current.onChange).toBe('function');
    expect(typeof result.current.onAnimate).toBe('function');
  });
});
