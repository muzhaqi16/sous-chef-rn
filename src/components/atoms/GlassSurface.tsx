import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { withUnistyles } from 'react-native-unistyles';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

export interface GlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
}

type GlassScheme = React.ComponentProps<typeof LiquidGlassView>['colorScheme'];

// The app's theme, not the system's: the in-app setting can differ from the OS.
const glassSchemeFor = (themeName: string | undefined): GlassScheme =>
  themeName === 'dark' ? 'dark' : 'light';

const ThemedLiquidGlassView = withUnistyles(LiquidGlassView, (theme, rt) => ({
  colorScheme: glassSchemeFor(rt.themeName),
  tintColor: theme.colors.glassTint,
}));

/**
 * The liquid-glass fill, or nothing where the platform lacks the material; the
 * caller paints its own opaque fallback.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({ style }) => {
  if (!isLiquidGlassSupported) return null;
  return (
    <ThemedLiquidGlassView
      effect="regular"
      style={style}
      pointerEvents="none"
    />
  );
};

/** True where the platform renders the material — iOS 26 and later. */
export const supportsGlass = isLiquidGlassSupported;
