import { useFocusEffect } from '@react-navigation/native';
import { SystemBars } from 'react-native-edge-to-edge';

/**
 * Hides the status + navigation bars while the screen is focused and
 * restores them automatically on blur/unmount. Uses SystemBars' own
 * stack API so the root <ThemedStatusBar /> remains the single source
 * of truth for default theming.
 */
export const useHiddenStatusBar = () => {
  const onFocus = () => {
    const entry = SystemBars.pushStackEntry({ hidden: true });
    return () => SystemBars.popStackEntry(entry);
  };

  useFocusEffect(onFocus);
};
