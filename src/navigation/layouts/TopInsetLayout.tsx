import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { ScreenBoundary } from './ScreenBoundary';

/**
 * Applies the top safe-area inset per screen rather than globally, so an
 * immersive screen simply omits it, and the side insets a landscape cutout or
 * rounded corner takes. A `View` + padding, not `SafeAreaView`, so Unistyles
 * keeps it bound to the ShadowTree and a theme change needs no React re-render.
 */
export function TopInsetLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.fill,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {children}
    </View>
  );
}

/** `screenLayout` / `layout` value that insets a screen's top. */
export const topInsetScreenLayout = ({
  children,
}: {
  children: React.ReactElement;
}) => (
  <ScreenBoundary>
    <TopInsetLayout>{children}</TopInsetLayout>
  </ScreenBoundary>
);

/**
 * Combines the inset with an existing wrapper: a per-screen/group `layout`
 * REPLACES a parent `screenLayout` in react-navigation v8 rather than nesting.
 */
export const topInsetWith =
  (Boundary: React.ComponentType<{ children: React.ReactNode }>) =>
  ({ children }: { children: React.ReactElement }) =>
    (
      <Boundary>
        <ScreenBoundary>
          <TopInsetLayout>{children}</TopInsetLayout>
        </ScreenBoundary>
      </Boundary>
    );

/** A screen that draws under the status bar itself, such as a hero detail. */
export const edgeToEdgeScreenLayout = ({
  children,
}: {
  children: React.ReactElement;
}) => <ScreenBoundary>{children}</ScreenBoundary>;

/** A screen that is itself a navigator: its own screens bring their layout. */
export const navigatorScreenLayout = ({
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
