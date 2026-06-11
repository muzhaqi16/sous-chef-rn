import React from 'react';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useIsOfflineBannerVisible } from '#hooks/app/useIsOfflineBannerVisible';

/**
 * Single owner of the "offline banner consumes the top inset" rule.
 *
 * The OfflineBanner renders above this provider and carries the status-bar
 * inset itself, so while it is visible the safe-area insets are re-published
 * with `top: 0`. Every `useSafeAreaInsets` consumer below — TopInsetLayout,
 * immersive hero screens (CollapsingHeroDetail), toasts — adapts
 * automatically instead of each subscribing to banner visibility and
 * re-implementing the compensation.
 *
 * Native `SafeAreaView` components apply insets natively and ignore this
 * JS-context override; screens needing banner-aware top insets must read
 * `useSafeAreaInsets()` (directly or via TopInsetLayout).
 */
export const OfflineBannerInsetProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const bannerVisible = useIsOfflineBannerVisible();
  const value = bannerVisible ? { ...insets, top: 0 } : insets;
  return (
    <SafeAreaInsetsContext.Provider value={value}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
};
