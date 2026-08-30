import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

/** Android hardware back dismisses the sheet instead of exiting the app. */
export function useBottomSheetBackHandler(
  ref: React.RefObject<BottomSheetModal | null>,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleBackPress = () => {
      if (enabled && ref.current) {
        ref.current.dismiss();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [enabled, ref]);
}
