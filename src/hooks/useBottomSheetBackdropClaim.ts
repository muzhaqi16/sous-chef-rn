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
 * - Claims/releases the backdrop imperatively via `onChange(index)` from
 *   gorhom. Imperative management avoids the useEffect cleanup race that
 *   caused leaked claims when the React Compiler optimized effect deps.
 *
 * Backdrop-tap dismisses the sheet via the supplied ref.
 *
 * The caller wires the returned values into gorhom:
 * ```tsx
 * const { animatedIndex, onChange } = useBottomSheetBackdropClaim(sheetRef);
 * <BottomSheetModal
 *   ref={sheetRef}
 *   animatedIndex={animatedIndex}
 *   onChange={onChange}
 * />
 * ```
 */
export function useBottomSheetBackdropClaim(
  ref: RefObject<DismissableRef | null>,
): {
  animatedIndex: SharedValue<number>;
  onChange: (index: number) => void;
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

  const onChange = (index: number) => {
    if (index >= 0) claimBackdrop();
    else if (index === -1) releaseBackdrop();
  };

  return { animatedIndex, onChange };
}
