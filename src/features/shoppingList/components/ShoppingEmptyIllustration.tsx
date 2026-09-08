import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import type { SkPath } from '@shopify/react-native-skia';
import { Canvas, Group, Path, Circle, Skia } from '@shopify/react-native-skia';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { motion } from '#/theme/foundations/motion';

// Theme-reactive Skia primitives. The mapper takes the consumer-facing
// `tone` prop and resolves it to the appropriate icon color from the active
// theme — re-runs only on theme change, not on parent re-renders.
const ThemedPath = withUnistyles(Path);
const ThemedCircle = withUnistyles(Circle);

// Size configurations matching SousChefLoader
const SIZES = {
  small: { canvas: 120, scale: 0.6 },
  medium: { canvas: 180, scale: 0.9 },
  large: { canvas: 240, scale: 1.2 },
};

/** Build all Skia path objects for the shopping cart illustration. */
function buildCartPaths(cx: number, cy: number, scale: number) {
  const cartBodyPath = Skia.PathBuilder.Make()
    .moveTo(cx - 35 * scale, cy - 15 * scale)
    .lineTo(cx - 30 * scale, cy + 25 * scale)
    .lineTo(cx + 30 * scale, cy + 25 * scale)
    .lineTo(cx + 35 * scale, cy - 15 * scale)
    .detach();

  const cartHandlePath = Skia.PathBuilder.Make()
    .moveTo(cx - 35 * scale, cy - 15 * scale)
    .lineTo(cx - 50 * scale, cy - 15 * scale)
    .lineTo(cx - 55 * scale, cy - 25 * scale)
    .detach();

  const cartGridLines: SkPath[] = [];
  for (let i = -1; i <= 1; i++) {
    const xOffset = i * 18 * scale;
    cartGridLines.push(
      Skia.PathBuilder.Make()
        .moveTo(cx + xOffset, cy - 15 * scale)
        .lineTo(cx + xOffset - 2 * scale, cy + 25 * scale)
        .detach(),
    );
  }
  for (let i = 0; i <= 1; i++) {
    const yOffset = cy + i * 20 * scale - 5 * scale;
    const topWidth = 35 - i * 5;
    cartGridLines.push(
      Skia.PathBuilder.Make()
        .moveTo(cx - topWidth * scale, yOffset)
        .lineTo(cx + topWidth * scale, yOffset)
        .detach(),
    );
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
  const config = SIZES[size];
  const cx = config.canvas / 2;
  const cy = config.canvas / 2;
  const scale = config.scale;

  // Animation shared values
  const bobY = useSharedValue(0);
  const motionEnabled = useMotionEnabled();

  // Start bob animation on mount
  useLayoutEffect(() => {
    if (!motionEnabled) return;
    // Gentle continuous bob animation for empty cart
    bobY.set(
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1200, easing: motion.easing.emphasized }),
          withTiming(0, { duration: 1200, easing: motion.easing.emphasized }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(bobY);
    };
  }, [bobY, motionEnabled]);

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
          <ThemedPath
            path={cartBodyPath}
            style="stroke"
            strokeWidth={4 * scale}
            strokeCap="round"
            strokeJoin="round"
            uniProps={t => ({ color: t.colors.iconSecondary })}
          />
          {/* Cart handle */}
          <ThemedPath
            path={cartHandlePath}
            style="stroke"
            strokeWidth={4 * scale}
            strokeCap="round"
            strokeJoin="round"
            uniProps={t => ({ color: t.colors.iconSecondary })}
          />
          {/* Cart grid lines */}
          {cartGridLines.map((linePath, index) => (
            <ThemedPath
              key={index}
              path={linePath}
              style="stroke"
              strokeWidth={2 * scale}
              opacity={0.5}
              uniProps={t => ({ color: t.colors.iconTertiary })}
            />
          ))}
          {/* Cart wheels */}
          <ThemedCircle
            cx={cx - 20 * scale}
            cy={cy + 35 * scale}
            r={6 * scale}
            uniProps={t => ({ color: t.colors.iconSecondary })}
          />
          <ThemedCircle
            cx={cx + 20 * scale}
            cy={cy + 35 * scale}
            r={6 * scale}
            uniProps={t => ({ color: t.colors.iconSecondary })}
          />
          {/* Inner wheel circles */}
          <ThemedCircle
            cx={cx - 20 * scale}
            cy={cy + 35 * scale}
            r={3 * scale}
            uniProps={t => ({ color: t.colors.iconTertiary })}
          />
          <ThemedCircle
            cx={cx + 20 * scale}
            cy={cy + 35 * scale}
            r={3 * scale}
            uniProps={t => ({ color: t.colors.iconTertiary })}
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
