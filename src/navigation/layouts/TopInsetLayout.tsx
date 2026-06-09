import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useIsOfflineBannerVisible } from '#hooks/app/useIsOfflineBannerVisible';

/**
 * Applies the top safe-area inset to a single navigation screen.
 *
 * The app used to inset the top once, globally, in `App.tsx`. That made every
 * screen sit below the status bar — including the Recipe Detail hero image,
 * which we want to draw edge-to-edge behind the status bar. So the global inset
 * was removed and re-applied per screen via this layout (wired through
 * react-navigation's `layout` / `screenLayout`). Screens that should stay
 * immersive (Recipe Detail) simply omit it.
 *
 * Uses a `View` + `paddingTop` (not `SafeAreaView`) so the Unistyles babel
 * plugin keeps it bound to the native ShadowTree and theme changes apply
 * without a React re-render.
 *
 * While the offline banner is visible it occupies the status-bar inset itself,
 * so this layout drops its own inset to avoid stacking two insets below the
 * banner.
 */
export function TopInsetLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const bannerVisible = useIsOfflineBannerVisible();
  return (
    <View style={[styles.fill, { paddingTop: bannerVisible ? 0 : insets.top }]}>
      {children}
    </View>
  );
}

/** `screenLayout` / `layout` value that insets a screen's top. */
export const topInsetScreenLayout = ({
  children,
}: {
  children: React.ReactElement;
}) => <TopInsetLayout>{children}</TopInsetLayout>;

/**
 * Combines the top inset with an existing wrapper (e.g. an error boundary).
 * Needed because a per-screen/group `layout` REPLACES a parent `screenLayout`
 * in react-navigation v8 — it doesn't nest — so a group that already wraps its
 * screens in a boundary must fold the inset into the same function.
 */
export const topInsetWith =
  (Boundary: React.ComponentType<{ children: React.ReactNode }>) =>
  ({ children }: { children: React.ReactElement }) =>
    (
      <Boundary>
        <TopInsetLayout>{children}</TopInsetLayout>
      </Boundary>
    );

/**
 * Passthrough `layout` that adds NO inset. Used to opt a screen out of a
 * group-level `topInsetScreenLayout` (a nested navigator that insets its own
 * screens, or the tab host whose tabs inset themselves).
 */
export const noInsetScreenLayout = ({
  children,
}: {
  children: React.ReactElement;
}) => children;

const styles = StyleSheet.create(theme => ({
  fill: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
