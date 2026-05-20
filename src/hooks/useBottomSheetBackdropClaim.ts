import { useState, type RefObject } from 'react';
import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SHEET } from '#constants/animations';
import { useBackdropClaim } from '#components/providers/OverlayBackdropProvider';

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
 * - Tracks a local `isOpen` JS state driven by gorhom's `onChange(index)`
 *   callback (≥0 → open, -1 → closed). Delegates the actual claim/release
 *   to the declarative `useBackdropClaim`, which owns the effects and the
 *   defensive unmount cleanup.
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

  const [isOpen, setIsOpen] = useState(false);
  useBackdropClaim(isOpen, {
    opacity: opacitySV,
    onPress: () => ref.current?.dismiss(),
  });

  const onChange = (index: number) => {
    if (index >= 0) setIsOpen(true);
    else if (index === -1) setIsOpen(false);
  };

  return { animatedIndex, onChange };
}
