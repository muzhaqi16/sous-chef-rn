import { useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { motion } from '#/theme/foundations/motion';

/**
 * Shared animation configuration for all bottom sheet modals.
 * Uses a spring animation for snappy, natural-feeling sheet transitions.
 */
export const useSharedBottomSheetConfigs = () => {
  return useBottomSheetSpringConfigs({
    ...motion.spring.EXPAND,
    overshootClamping: true,
  });
};
