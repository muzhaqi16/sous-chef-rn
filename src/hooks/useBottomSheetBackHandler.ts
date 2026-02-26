import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

/**
 * Hook to handle Android hardware back button for bottom sheet modals.
 * When enabled and the bottom sheet is mounted, pressing back will dismiss
 * the sheet instead of exiting the app.
 *
 * @param ref - Reference to the BottomSheetModal
 * @param enabled - Whether the back handler should be active (typically tied to visible prop)
 */
export function useBottomSheetBackHandler(
  ref: React.RefObject<BottomSheetModal | null>,
  enabled: boolean = true,
) {
  const handleBackPress = () => {
    if (enabled && ref.current) {
      ref.current.dismiss();
      return true; // Prevent default (exit app)
    }
    return false; // Allow default behavior
  };

  useEffect(() => {
    if (!enabled) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [enabled, handleBackPress]);
}
