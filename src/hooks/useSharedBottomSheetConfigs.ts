import { useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';

/**
 * Shared animation configuration for all bottom sheet modals.
 * Uses a spring animation for snappy, natural-feeling sheet transitions.
 */
export const useSharedBottomSheetConfigs = () => {
  return useBottomSheetSpringConfigs({
    damping: 20,
    overshootClamping: true,
    stiffness: 200,
  });
};
