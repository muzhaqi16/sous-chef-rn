import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Applies the top safe-area inset per screen rather than globally, so an
 * immersive screen simply omits it. A `View` + `paddingTop`, not `SafeAreaView`,
 * so the Unistyles plugin keeps it bound to the ShadowTree and a theme change
 * needs no React re-render.
 */
export function TopInsetLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>{children}</View>
  );
}

/** `screenLayout` / `layout` value that insets a screen's top. */
export const topInsetScreenLayout = ({
  children,
}: {
  children: React.ReactElement;
}) => <TopInsetLayout>{children}</TopInsetLayout>;

/**
 * Combines the inset with an existing wrapper: a per-screen/group `layout`
 * REPLACES a parent `screenLayout` in react-navigation v8 rather than nesting.
 */
export const topInsetWith =
  (Boundary: React.ComponentType<{ children: React.ReactNode }>) =>
  ({ children }: { children: React.ReactElement }) =>
    (
      <Boundary>
        <TopInsetLayout>{children}</TopInsetLayout>
      </Boundary>
    );

/** Opts a screen out of a group-level `topInsetScreenLayout`. */
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
