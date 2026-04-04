import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Path, Circle, Skia } from '@shopify/react-native-skia';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

// Size configurations matching SousChefLoader
const SIZES = {
  small: { canvas: 120, scale: 0.6 },
  medium: { canvas: 180, scale: 0.9 },
  large: { canvas: 240, scale: 1.2 },
};

/** Build all Skia path objects for the shopping cart illustration. */
function buildCartPaths(cx: number, cy: number, scale: number) {
  const cartBodyPath = Skia.Path.Make();
  cartBodyPath.moveTo(cx - 35 * scale, cy - 15 * scale);
  cartBodyPath.lineTo(cx - 30 * scale, cy + 25 * scale);
  cartBodyPath.lineTo(cx + 30 * scale, cy + 25 * scale);
  cartBodyPath.lineTo(cx + 35 * scale, cy - 15 * scale);

  const cartHandlePath = Skia.Path.Make();
  cartHandlePath.moveTo(cx - 35 * scale, cy - 15 * scale);
  cartHandlePath.lineTo(cx - 50 * scale, cy - 15 * scale);
  cartHandlePath.lineTo(cx - 55 * scale, cy - 25 * scale);

  const cartGridLines: ReturnType<typeof Skia.Path.Make>[] = [];
  for (let i = -1; i <= 1; i++) {
    const line = Skia.Path.Make();
    const xOffset = i * 18 * scale;
    line.moveTo(cx + xOffset, cy - 15 * scale);
    line.lineTo(cx + xOffset - 2 * scale, cy + 25 * scale);
    cartGridLines.push(line);
  }
  for (let i = 0; i <= 1; i++) {
    const line = Skia.Path.Make();
    const yOffset = cy + i * 20 * scale - 5 * scale;
    const topWidth = 35 - i * 5;
    line.moveTo(cx - topWidth * scale, yOffset);
    line.lineTo(cx + topWidth * scale, yOffset);
    cartGridLines.push(line);
  }

  return { cartBodyPath, cartHandlePath, cartGridLines };
}

// Pre-build cart paths for each size at module scope (only 3 variants, created once)
const CART_PATH_CACHE = Object.fromEntries(
  Object.entries(SIZES).map(([key, { canvas, scale }]) => [
    key,
    buildCartPaths(canvas / 2, canvas / 2, scale),
  ]),
) as Record<keyof typeof SIZES, ReturnType<typeof buildCartPaths>>;

interface ShoppingEmptyIllustrationProps {
  size?: 'small' | 'medium' | 'large';
}

export const ShoppingEmptyIllustration: React.FC<
  ShoppingEmptyIllustrationProps
> = ({ size = 'medium' }) => {
  const { theme } = useUnistyles();

  // Theme-aware colors
  const colors = {
    // Cart - use secondary/tertiary icon colors for theme support
    cart: theme.colors.iconSecondary,
    cartOutline: theme.colors.iconTertiary,
  };

  const config = SIZES[size];
  const cx = config.canvas / 2;
  const cy = config.canvas / 2;
  const scale = config.scale;

  // Animation shared values
  const bobY = useSharedValue(0);

  // Start bob animation on mount
  useLayoutEffect(() => {
    // Gentle continuous bob animation for empty cart
    bobY.set(
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(bobY);
    };
  }, [bobY]);

  // Derived transforms
  const bobTransform = useDerivedValue(() => [
    { translateY: bobY.get() * scale },
  ]);

  // Use pre-built paths from module-scope cache (avoids native object allocation per render)
  const { cartBodyPath, cartHandlePath, cartGridLines } = CART_PATH_CACHE[size];

  return (
    <View style={componentStyles.container}>
      <Canvas style={{ width: config.canvas, height: config.canvas }}>
        <Group transform={bobTransform}>
          {/* Cart body outline */}
          <Path
            path={cartBodyPath}
            color={colors.cart}
            style="stroke"
            strokeWidth={4 * scale}
            strokeCap="round"
            strokeJoin="round"
          />
          {/* Cart handle */}
          <Path
            path={cartHandlePath}
            color={colors.cart}
            style="stroke"
            strokeWidth={4 * scale}
            strokeCap="round"
            strokeJoin="round"
          />
          {/* Cart grid lines */}
          {cartGridLines.map((linePath, index) => (
            <Path
              key={index}
              path={linePath}
              color={colors.cartOutline}
              style="stroke"
              strokeWidth={2 * scale}
              opacity={0.5}
            />
          ))}
          {/* Cart wheels */}
          <Circle
            cx={cx - 20 * scale}
            cy={cy + 35 * scale}
            r={6 * scale}
            color={colors.cart}
          />
          <Circle
            cx={cx + 20 * scale}
            cy={cy + 35 * scale}
            r={6 * scale}
            color={colors.cart}
          />
          {/* Inner wheel circles */}
          <Circle
            cx={cx - 20 * scale}
            cy={cy + 35 * scale}
            r={3 * scale}
            color={colors.cartOutline}
          />
          <Circle
            cx={cx + 20 * scale}
            cy={cy + 35 * scale}
            r={3 * scale}
            color={colors.cartOutline}
          />
        </Group>
      </Canvas>
    </View>
  );
};

// Convenience exports for size variants
export const ShoppingEmptyIllustrationSmall: React.FC = () => (
  <ShoppingEmptyIllustration size="small" />
);

export const ShoppingEmptyIllustrationMedium: React.FC = () => (
  <ShoppingEmptyIllustration size="medium" />
);

export const ShoppingEmptyIllustrationLarge: React.FC = () => (
  <ShoppingEmptyIllustration size="large" />
);

const componentStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
