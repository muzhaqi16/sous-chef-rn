import { useEffect, useRef, useState, type RefObject } from 'react';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useOverlayBackdropOptional } from '#components/providers/OverlayBackdropProvider';
import { useSheetBackdropOpacity } from '#hooks/useSheetBackdropOpacity';

interface DismissableRef {
  dismiss: () => void;
}

/**
 * Backdrop integration for a `BottomSheetModal`. Owns the SharedValue
 * plumbing that ties the global dim layer to the sheet's motion:
 *
 * - Creates an `animatedIndex` SharedValue the caller hands to gorhom via
 *   `<BottomSheetModal animatedIndex={animatedIndex} />`. Gorhom drives it
 *   as the sheet animates (same mechanism gorhom uses for its built-in
 *   backdrop).
 * - Derives an opacity SharedValue from `animatedIndex` via
 *   `interpolate(animatedIndex, [-1, 0], [0, SHEET.BACKDROP_OPACITY])` and
 *   claims the global backdrop with it. The dim layer ramps in/out on the
 *   UI thread, frame-synced with the sheet — zero JS-thread delay.
 * - Claims the backdrop at the START of the open animation via gorhom's
 *   `onAnimate` callback (synchronous, so the dim ramps in with no pop), and
 *   releases it via a `useAnimatedReaction` watching `animatedIndex` settle at
 *   the closed anchor (-1) — NOT gorhom's `onChange(-1)`, which gorhom skips on
 *   interrupted closes. The SV reaches -1 on every close, so release is reliable.
 *
 * Backdrop-tap dismisses the sheet via the supplied ref.
 *
 * The caller wires the returned values into gorhom:
 * ```tsx
 * const { animatedIndex, onChange, onAnimate } =
 *   useBottomSheetBackdropClaim(sheetRef);
 * <BottomSheetModal
 *   ref={sheetRef}
 *   animatedIndex={animatedIndex}
 *   onChange={onChange}
 *   onAnimate={onAnimate}
 * />
 * ```
 */
export function useBottomSheetBackdropClaim(
  ref: RefObject<DismissableRef | null>,
): {
  animatedIndex: SharedValue<number>;
  onChange: (index: number) => void;
  onAnimate: (fromIndex: number, toIndex: number) => void;
} {
  const { animatedIndex, backdropOpacity: opacitySV } =
    useSheetBackdropOpacity();

  const { claim, release } = useOverlayBackdropOptional();
  const claimIdRef = useRef<string | null>(null);
  const onPressRef = useRef(() => ref.current?.dismiss());
  useEffect(() => {
    onPressRef.current = () => ref.current?.dismiss();
  });
  const [stableOnPress] = useState<() => void>(
    () => () => onPressRef.current(),
  );

  const claimBackdrop = () => {
    if (claimIdRef.current != null) return;
    claimIdRef.current = claim({ opacity: opacitySV, onPress: stableOnPress });
  };

  const releaseBackdrop = () => {
    if (claimIdRef.current == null) return;
    release(claimIdRef.current);
    claimIdRef.current = null;
  };

  // Stable, RN-scope wrapper so the worklet boundary (`scheduleOnRN` in the
  // release reaction below) binds a fixed function identity while still calling
  // the latest `releaseBackdrop`.
  const releaseRef = useRef(releaseBackdrop);
  useEffect(() => {
    releaseRef.current = releaseBackdrop;
  });
  const [stableRelease] = useState<() => void>(
    () => () => releaseRef.current(),
  );

  // Defensive unmount cleanup — the guaranteed release backstop.
  useEffect(() => {
    return () => releaseBackdrop();
  }, []);

  // RELEASE is driven off the sheet's own `animatedIndex` settling at the closed
  // anchor (-1), NOT off gorhom's `onChange(-1)`. Gorhom skips `onChange(-1)`
  // when a close interrupts an open that never settled, which stranded the dim.
  // `animatedIndex` is driven by the spring on the UI thread and reaches exactly
  // -1 on every close (reanimated snaps to `toValue` at rest under
  // `overshootClamping`), so this fires reliably. A fast reopen — where the SV
  // turns back before reaching -1 — never fires, so the slot is reused with no
  // stale-release race. The unmount cleanup above is the final backstop.
  useAnimatedReaction(
    () => animatedIndex.get() <= -0.999,
    (closed, previous) => {
      if (closed && previous === false) scheduleOnRN(stableRelease);
    },
  );

  // CLAIM synchronously at the START of the open animation so the dim ramps in
  // lockstep with the sheet (no pop-in). `onAnimate` fires one step before gorhom
  // begins driving `animatedPosition` (BottomSheet.tsx:682), with `toIndex >= 0`
  // when opening or moving between snap points; the provider's max-over-slots
  // opacity then reads this sheet's `interpolate(animatedIndex)` SV for the whole
  // ramp. `onChange(index >= 0)` is the idempotent backstop for a `present()`
  // while already open (where `onAnimate`'s `toIndex === currentIndex`
  // early-returns — BottomSheet.tsx:485).
  const onAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex >= 0) claimBackdrop();
  };

  const onChange = (index: number) => {
    if (index >= 0) claimBackdrop();
  };

  return { animatedIndex, onChange, onAnimate };
}
