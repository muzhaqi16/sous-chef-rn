import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

export interface GlassSurfaceProps {
  /**
   * Painted behind the glass. It is a scrim, not a theme fill: the material
   * shows what is under it, so the tint only deepens the contrast.
   */
  tint?: { light: string; dark: string };
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_TINT = {
  light: 'rgba(255, 255, 255, 0.4)',
  dark: 'rgba(28, 27, 32, 0.4)',
};

/**
 * The liquid-glass fill, or nothing where the platform lacks the material; the
 * caller paints its own opaque fallback. `themeName` FIRST, as `useTheme` and
 * `RootNavigator` resolve it — an in-app theme choice does not move
 * `colorScheme`, which left the glass light under a dark theme.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  tint = DEFAULT_TINT,
  style,
}) => {
  const { rt } = useUnistyles();
  if (!isLiquidGlassSupported) return null;
  const scheme = (rt.themeName || rt.colorScheme) === 'dark' ? 'dark' : 'light';
  return (
    <LiquidGlassView
      effect="regular"
      colorScheme={scheme}
      tintColor={tint[scheme]}
      style={style}
      pointerEvents="none"
    />
  );
};

/** True where the platform renders the material — iOS 26 and later. */
export const supportsGlass = isLiquidGlassSupported;

/** A `View` for the fallback, so a caller need not import the flag. */
export const GlassFallback: React.FC<{ style?: StyleProp<ViewStyle> }> = ({
  style,
}) => (isLiquidGlassSupported ? null : <View style={style} />);
