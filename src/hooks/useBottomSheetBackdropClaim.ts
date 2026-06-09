import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SHEET } from '#constants/animations';
import { useOverlayBackdropOptional } from '#components/providers/OverlayBackdropProvider';

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
 *   `onAnimate` callback, and releases it at the END of the close animation
 *   via `onChange(-1)`. This split is load-bearing — see `onAnimate`/`onChange`
 *   below for why the claim is early but the release is late.
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
  const animatedIndex = useSharedValue(-1);
  const opacitySV = useDerivedValue(() =>
    interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, SHEET.BACKDROP_OPACITY],
      Extrapolation.CLAMP,
    ),
  );

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

  // Defensive unmount cleanup
  useEffect(() => {
    return () => releaseBackdrop();
  }, []);

  // Claim at the START of the open animation. Gorhom fires `onAnimate` one
  // step before it begins driving `animatedPosition` (BottomSheet.tsx:682),
  // with `toIndex >= 0` when opening or moving between snap points. Claiming
  // here registers the slot before the open ramp runs, so the provider's
  // max-over-slots opacity derivation reads this sheet's
  // `interpolate(animatedIndex)` SV for the whole ramp and the dim fades in
  // frame-synced with the sheet.
  //
  // `onChange(index)` fires only AFTER the animation settles (from gorhom's
  // `animateToPositionCompleted`, BottomSheet.tsx:558). Claiming there left
  // the slot unregistered during the entire open animation, so the dim
  // popped in at the end instead of tracking the sheet. `onChange(index >= 0)`
  // is kept as an idempotent backstop for the rare case gorhom skips
  // `onAnimate` (a `present()` while already open, where `onAnimate`'s
  // `toIndex === currentIndex` early-return trips — BottomSheet.tsx:485).
  const onAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex >= 0) claimBackdrop();
  };

  // Release ONLY on the authoritative settled-closed signal. Release is
  // deliberately NOT mirrored onto `onAnimate(toIndex === -1)`: `onAnimate`
  // fires at the START of the close (and on non-completing pan-down gestures
  // and intermediate snaps), so releasing there would drop the dim mid-gesture
  // or snap it out before the lockstep ramp-down plays. `useStandardBottomSheet`
  // adds two more idempotent release paths (a release in its `onDismiss`
  // wrapper, covering gorhom's `onClose` winning the race against
  // `onChange(-1)`, plus the defensive unmount cleanup above).
  const onChange = (index: number) => {
    if (index >= 0) claimBackdrop();
    else if (index === -1) releaseBackdrop();
  };

  return { animatedIndex, onChange, onAnimate };
}
