import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/** Android hardware back dismisses the sheet instead of exiting the app. */
export function useBottomSheetBackHandler(
  ref: React.RefObject<{ dismiss: () => void } | null>,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleBackPress = () => {
      if (ref.current) {
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
