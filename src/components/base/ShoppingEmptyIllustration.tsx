import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Group,
  Path,
  Circle,
  Skia,
} from '@shopify/react-native-skia';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  SharedValue,
} from 'react-native-reanimated';

// Size configurations matching SousChefLoader
const SIZES = {
  small: { canvas: 120, scale: 0.6 },
  medium: { canvas: 180, scale: 0.9 },
  large: { canvas: 240, scale: 1.2 },
};

// Confetti particle configuration
const CONFETTI_COUNT = 12;

interface ShoppingEmptyIllustrationProps {
  variant: 'complete' | 'empty';
  size?: 'small' | 'medium' | 'large';
}

interface ConfettiParticleProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  particleSize: number;
  scale: number;
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
}

// Separate component for each confetti particle to properly use hooks
const ConfettiParticle: React.FC<ConfettiParticleProps> = ({
  startX,
  startY,
  endX,
  endY,
  color,
  particleSize,
  scale,
  progress,
  opacity,
}) => {
  const x = useDerivedValue(() => {
    return startX + (endX - startX) * progress.value;
  });
  const y = useDerivedValue(() => {
    return startY + (endY - startY) * progress.value;
  });
  const particleOpacity = useDerivedValue(() => opacity.value);

  return (
    <Circle
      cx={x}
      cy={y}
      r={particleSize * scale}
      color={color}
      opacity={particleOpacity}
    />
  );
};

export const ShoppingEmptyIllustration: React.FC<ShoppingEmptyIllustrationProps> = ({
  variant,
  size = 'medium',
}) => {
  const { theme } = useUnistyles();

  // Theme-aware colors
  const colors = useMemo(() => ({
    // Bag colors - use warm tones from jaffa palette
    bag: theme.colors.jaffa[300],
    bagDark: theme.colors.jaffa[400],
    // Success checkmark - use semantic success color
    checkCircle: theme.colors.success,
    checkMark: theme.colors.white,
    // Cart - use secondary/tertiary icon colors for theme support
    cart: theme.colors.iconSecondary,
    cartOutline: theme.colors.iconTertiary,
    // Confetti - mix of theme-friendly colors
    confetti: [
      theme.colors.primary,           // Orange (jaffa)
      theme.colors.success,           // Green
      theme.colors.jaffa[200],        // Light orange
      theme.colors.charade[400],      // Purple-ish
      theme.colors.jaffa[500],        // Deeper orange
      theme.colors.info,              // Blue
    ],
  }), [theme]);

  const config = SIZES[size];
  const cx = config.canvas / 2;
  const cy = config.canvas / 2;
  const scale = config.scale;

  // Animation shared values
  const bobY = useSharedValue(0);
  const confettiProgress = useSharedValue(0);
  const confettiOpacity = useSharedValue(1);

  // Vertical offset to center the bag illustration (bag spans from -35 to +50 from cy)
  const bagYOffset = 8 * scale;

  // Generate confetti particles with deterministic positions
  const confettiData = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
      const angle = (i * 360) / CONFETTI_COUNT + (i % 2 === 0 ? 15 : -15);
      const distance = 40 + (i % 3) * 15;
      const angleRad = (angle * Math.PI) / 180;
      const startX = cx;
      const startY = cy - bagYOffset - 20 * scale;
      const endX = startX + Math.cos(angleRad) * distance * scale;
      const endY = startY + Math.sin(angleRad) * distance * scale - 30 * scale;

      return {
        startX,
        startY,
        endX,
        endY,
        color: colors.confetti[i % colors.confetti.length],
        size: 4 + (i % 3) * 2,
      };
    });
  }, [cx, cy, scale, bagYOffset, colors.confetti]);

  // Start animations on mount
  useEffect(() => {
    if (variant === 'empty') {
      // Gentle continuous bob animation for empty cart
      bobY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else if (variant === 'complete') {
      // One-time confetti burst animation
      confettiProgress.value = withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
      confettiOpacity.value = withDelay(
        400,
        withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }),
      );
    }
  }, [variant, bobY, confettiProgress, confettiOpacity]);

  // Derived transforms
  const bobTransform = useDerivedValue(() => [
    { translateY: bobY.value * scale },
  ]);

  // Create shopping bag paths for complete variant
  const bagBodyPath = useMemo(() => {
    const path = Skia.Path.Make();
    // Bag body - rounded rectangle shape
    const by = cy - bagYOffset;
    path.moveTo(cx - 35 * scale, by - 10 * scale);
    path.lineTo(cx - 40 * scale, by + 40 * scale);
    path.quadTo(cx - 40 * scale, by + 50 * scale, cx - 30 * scale, by + 50 * scale);
    path.lineTo(cx + 30 * scale, by + 50 * scale);
    path.quadTo(cx + 40 * scale, by + 50 * scale, cx + 40 * scale, by + 40 * scale);
    path.lineTo(cx + 35 * scale, by - 10 * scale);
    path.close();
    return path;
  }, [cx, cy, scale, bagYOffset]);

  const bagTopPath = useMemo(() => {
    const path = Skia.Path.Make();
    // Bag top fold
    const by = cy - bagYOffset;
    path.moveTo(cx - 38 * scale, by - 15 * scale);
    path.lineTo(cx + 38 * scale, by - 15 * scale);
    path.lineTo(cx + 35 * scale, by - 5 * scale);
    path.lineTo(cx - 35 * scale, by - 5 * scale);
    path.close();
    return path;
  }, [cx, cy, scale, bagYOffset]);

  const bagHandlePath = useMemo(() => {
    const path = Skia.Path.Make();
    // Bag handle (arc)
    const by = cy - bagYOffset;
    path.moveTo(cx - 15 * scale, by - 15 * scale);
    path.quadTo(cx - 15 * scale, by - 35 * scale, cx, by - 35 * scale);
    path.quadTo(cx + 15 * scale, by - 35 * scale, cx + 15 * scale, by - 15 * scale);
    return path;
  }, [cx, cy, scale, bagYOffset]);

  // Checkmark positioned in lower portion of bag
  const checkCy = cy - bagYOffset + 15 * scale;

  const checkMarkPath = useMemo(() => {
    const path = Skia.Path.Make();
    // Checkmark inside circle
    path.moveTo(cx - 10 * scale, checkCy);
    path.lineTo(cx - 3 * scale, checkCy + 8 * scale);
    path.lineTo(cx + 12 * scale, checkCy - 8 * scale);
    return path;
  }, [cx, checkCy, scale]);

  // Create empty cart paths
  const cartBodyPath = useMemo(() => {
    const path = Skia.Path.Make();
    // Cart basket
    path.moveTo(cx - 35 * scale, cy - 15 * scale);
    path.lineTo(cx - 30 * scale, cy + 25 * scale);
    path.lineTo(cx + 30 * scale, cy + 25 * scale);
    path.lineTo(cx + 35 * scale, cy - 15 * scale);
    return path;
  }, [cx, cy, scale]);

  const cartHandlePath = useMemo(() => {
    const path = Skia.Path.Make();
    // Cart handle extending left
    path.moveTo(cx - 35 * scale, cy - 15 * scale);
    path.lineTo(cx - 50 * scale, cy - 15 * scale);
    path.lineTo(cx - 55 * scale, cy - 25 * scale);
    return path;
  }, [cx, cy, scale]);

  const cartGridLines = useMemo(() => {
    const lines: ReturnType<typeof Skia.Path.Make>[] = [];
    // Vertical lines
    for (let i = -1; i <= 1; i++) {
      const line = Skia.Path.Make();
      const xOffset = i * 18 * scale;
      line.moveTo(cx + xOffset, cy - 15 * scale);
      line.lineTo(cx + xOffset - 2 * scale, cy + 25 * scale);
      lines.push(line);
    }
    // Horizontal lines
    for (let i = 0; i <= 1; i++) {
      const line = Skia.Path.Make();
      const yOffset = cy + i * 20 * scale - 5 * scale;
      const topWidth = 35 - i * 5;
      line.moveTo(cx - topWidth * scale, yOffset);
      line.lineTo(cx + topWidth * scale, yOffset);
      lines.push(line);
    }
    return lines;
  }, [cx, cy, scale]);

  if (variant === 'complete') {
    return (
      <View style={componentStyles.container}>
        <Canvas style={{ width: config.canvas, height: config.canvas }}>
          {/* Confetti particles */}
          {confettiData.map((particle, index) => (
            <ConfettiParticle
              key={index}
              startX={particle.startX}
              startY={particle.startY}
              endX={particle.endX}
              endY={particle.endY}
              color={particle.color}
              particleSize={particle.size}
              scale={scale}
              progress={confettiProgress}
              opacity={confettiOpacity}
            />
          ))}

          {/* Shopping bag */}
          <Group>
            {/* Bag body */}
            <Path path={bagBodyPath} color={colors.bag} />
            {/* Bag top fold */}
            <Path path={bagTopPath} color={colors.bagDark} />
            {/* Bag handle */}
            <Path
              path={bagHandlePath}
              color={colors.bagDark}
              style="stroke"
              strokeWidth={4 * scale}
              strokeCap="round"
            />
          </Group>

          {/* Checkmark circle */}
          <Circle
            cx={cx}
            cy={checkCy}
            r={18 * scale}
            color={colors.checkCircle}
          />
          {/* Checkmark */}
          <Path
            path={checkMarkPath}
            color={colors.checkMark}
            style="stroke"
            strokeWidth={4 * scale}
            strokeCap="round"
            strokeJoin="round"
          />
        </Canvas>
      </View>
    );
  }

  // Empty cart variant
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
export const ShoppingEmptyIllustrationSmall: React.FC<
  Omit<ShoppingEmptyIllustrationProps, 'size'>
> = props => <ShoppingEmptyIllustration size="small" {...props} />;

export const ShoppingEmptyIllustrationMedium: React.FC<
  Omit<ShoppingEmptyIllustrationProps, 'size'>
> = props => <ShoppingEmptyIllustration size="medium" {...props} />;

export const ShoppingEmptyIllustrationLarge: React.FC<
  Omit<ShoppingEmptyIllustrationProps, 'size'>
> = props => <ShoppingEmptyIllustration size="large" {...props} />;

const componentStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
