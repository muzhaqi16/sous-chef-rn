import { useBottomSheetTimingConfigs } from '@gorhom/bottom-sheet';
import { Easing } from 'react-native-reanimated';

/**
 * Shared animation configuration for all bottom sheet modals.
 * Provides consistent 300ms ease-out animation across the app.
 */
export const useSharedBottomSheetConfigs = () => {
  return useBottomSheetTimingConfigs({
    duration: 300,
    easing: Easing.out(Easing.ease),
  });
};
