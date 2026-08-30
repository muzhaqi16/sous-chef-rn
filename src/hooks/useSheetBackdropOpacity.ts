import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SHEET } from '#constants/animations';

/**
 * The ONE index→opacity curve for sheet backdrops, so the dim and the tab bar's
 * normalization cannot drift. The two claim lifecycles stay separate: ActionTray
 * claims declaratively from `mounted`, `useBottomSheetBackdropClaim`
 * imperatively, because a standard sheet stays portaled across open/close.
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
