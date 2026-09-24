import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { colors } from '#/theme/foundations/colors';

export interface GlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * The liquid-glass fill, or nothing where the platform lacks the material; the
 * caller paints its own opaque fallback. Dark in both themes: the chrome it
 * backs keeps light glyphs whichever theme is chosen.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({ style }) => {
  if (!isLiquidGlassSupported) return null;
  return (
    <LiquidGlassView
      effect="regular"
      colorScheme="dark"
      tintColor={colors.glass}
      style={style}
      pointerEvents="none"
    />
  );
};

/** True where the platform renders the material — iOS 26 and later. */
export const supportsGlass = isLiquidGlassSupported;
