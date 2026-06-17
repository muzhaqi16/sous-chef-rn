import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SHEET } from '#constants/animations';

/**
 * Shared backdrop-opacity plumbing for bottom sheets. Creates the
 * `animatedIndex` SharedValue that gorhom drives as the sheet animates, and
 * derives the global-backdrop opacity from it —
 * `interpolate(animatedIndex, [-1, 0] → [0, SHEET.BACKDROP_OPACITY])` — so the
 * dim ramps in and out in lockstep with the sheet on the UI thread.
 *
 * This is the single source of truth for the index→opacity curve. Both
 * backdrop-claim lifecycle models consume it, and they are intentionally
 * kept separate — only this opacity mapping is shared:
 *
 * - `ActionTray` claims **declaratively** (tied to its `mounted` React state via
 *   `useBackdropClaim`), so the slot is released deterministically on close or
 *   unmount — leak-proof even when navigation interrupts a close.
 * - `useBottomSheetBackdropClaim` claims **imperatively** (off gorhom's
 *   `onAnimate`/`onChange`), so the slot registers synchronously at the start of
 *   the open animation. A `mounted`-tied claim can't do that for standard
 *   sheets, which stay portaled across open/close rather than mounting per-open.
 *
 * Sharing only the curve means the dim and the floating tab bar's
 * `opacity / BACKDROP_OPACITY` normalization can never drift apart.
 */
export function useSheetBackdropOpacity(): {
  animatedIndex: SharedValue<number>;
  backdropOpacity: SharedValue<number>;
} {
  const animatedIndex = useSharedValue(-1);
  const backdropOpacity = useDerivedValue(() =>
    interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, SHEET.BACKDROP_OPACITY],
      Extrapolation.CLAMP,
    ),
  );
  return { animatedIndex, backdropOpacity };
}
