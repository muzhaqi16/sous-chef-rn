import React, { useLayoutEffect } from 'react';
import { View, Text } from 'react-native';
import {
  Canvas,
  Group,
  Path,
  RoundedRect,
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
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

// Colors for the grocery bag illustration
const COLORS = {
  bag: '#D4A574',
  bagDark: '#C4956A',
  baguette: '#F5A623',
  baguetteLines: '#8B5A2B',
  tomato: '#E53935',
  tomatoHighlight: '#EF5350',
  tomatoStem: '#4CAF50',
  leaves: '#66BB6A',
  leavesDark: '#43A047',
  banner: '#FFF3E0',
  bannerText: '#F76818',
};

// Size configurations
const SIZES = {
  small: { canvas: 120, scale: 0.6 },
  medium: { canvas: 180, scale: 0.9 },
  large: { canvas: 240, scale: 1.2 },
};

/** Build all Skia path objects for a given size configuration. */
function buildPaths(cx: number, cy: number, scale: number) {
  const baguette = Skia.Path.Make();
  baguette.moveTo(cx - 25 * scale, cy - 45 * scale);
  baguette.quadTo(
    cx - 30 * scale,
    cy - 55 * scale,
    cx - 20 * scale,
    cy - 70 * scale,
  );
  baguette.quadTo(
    cx - 15 * scale,
    cy - 80 * scale,
    cx - 10 * scale,
    cy - 75 * scale,
  );
  baguette.quadTo(
    cx - 5 * scale,
    cy - 65 * scale,
    cx - 15 * scale,
    cy - 45 * scale,
  );
  baguette.close();

  const line1 = Skia.Path.Make();
  line1.moveTo(cx - 22 * scale, cy - 55 * scale);
  line1.lineTo(cx - 14 * scale, cy - 52 * scale);

  const line2 = Skia.Path.Make();
  line2.moveTo(cx - 20 * scale, cy - 62 * scale);
  line2.lineTo(cx - 12 * scale, cy - 59 * scale);

  const line3 = Skia.Path.Make();
  line3.moveTo(cx - 17 * scale, cy - 69 * scale);
  line3.lineTo(cx - 11 * scale, cy - 67 * scale);

  const leaf1 = Skia.Path.Make();
  leaf1.moveTo(cx + 20 * scale, cy - 40 * scale);
  leaf1.quadTo(
    cx + 30 * scale,
    cy - 60 * scale,
    cx + 25 * scale,
    cy - 70 * scale,
  );
  leaf1.quadTo(
    cx + 20 * scale,
    cy - 65 * scale,
    cx + 15 * scale,
    cy - 50 * scale,
  );
  leaf1.close();

  const leaf2 = Skia.Path.Make();
  leaf2.moveTo(cx + 30 * scale, cy - 35 * scale);
  leaf2.quadTo(
    cx + 45 * scale,
    cy - 50 * scale,
    cx + 40 * scale,
    cy - 60 * scale,
  );
  leaf2.quadTo(
    cx + 35 * scale,
    cy - 55 * scale,
    cx + 25 * scale,
    cy - 40 * scale,
  );
  leaf2.close();

  const stem = Skia.Path.Make();
  stem.moveTo(cx + 5 * scale, cy - 68 * scale);
  stem.quadTo(
    cx + 8 * scale,
    cy - 73 * scale,
    cx + 12 * scale,
    cy - 71 * scale,
  );
  stem.quadTo(cx + 8 * scale, cy - 69 * scale, cx + 5 * scale, cy - 68 * scale);

  return {
    baguettePath: baguette,
    baguetteLine1: line1,
    baguetteLine2: line2,
    baguetteLine3: line3,
    leaf1Path: leaf1,
    leaf2Path: leaf2,
    stemPath: stem,
  };
}

// Pre-build paths for each size at module scope (only 3 variants, created once)
const PATH_CACHE = Object.fromEntries(
  Object.entries(SIZES).map(([key, { canvas, scale }]) => [
    key,
    buildPaths(canvas / 2, canvas / 2, scale),
  ]),
) as Record<keyof typeof SIZES, ReturnType<typeof buildPaths>>;

interface SousChefLoaderProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  showBrand?: boolean;
}

export const SousChefLoader: React.FC<SousChefLoaderProps> = ({
  size = 'medium',
  message = 'Please Wait',
  showBrand = true,
}) => {
  const { theme } = useUnistyles();
  const config = SIZES[size];

  // Animation shared values for each item
  const baguetteY = useSharedValue(0);
  const tomatoY = useSharedValue(0);
  const leavesY = useSharedValue(0);

  // Start animations on mount with staggered timing (all on UI thread)
  useLayoutEffect(() => {
    const bounceConfig = {
      duration: 600,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    };

    const bounce = (amplitude: number) =>
      withRepeat(
        withSequence(
          withTiming(-amplitude, bounceConfig),
          withTiming(0, bounceConfig),
        ),
        -1,
        false,
      );

    // Baguette bounce (first)
    baguetteY.set(bounce(12));

    // Tomato bounce (delayed by 200ms on UI thread)
    tomatoY.set(withDelay(200, bounce(10)));

    // Leaves bounce (delayed by 400ms on UI thread)
    leavesY.set(withDelay(400, bounce(8)));

    return () => {
      cancelAnimation(baguetteY);
      cancelAnimation(tomatoY);
      cancelAnimation(leavesY);
    };
  }, [baguetteY, tomatoY, leavesY]);

  // Derived transforms for Skia
  const baguetteTransform = useDerivedValue(() => [
    { translateY: baguetteY.get() * config.scale },
  ]);

  const tomatoTransform = useDerivedValue(() => [
    { translateY: tomatoY.get() * config.scale },
  ]);

  const leavesTransform = useDerivedValue(() => [
    { translateY: leavesY.get() * config.scale },
  ]);

  // Canvas center point
  const cx = config.canvas / 2;
  const cy = config.canvas / 2;
  const scale = config.scale;

  // Use pre-built paths from module-scope cache (avoids native object allocation per render)
  const {
    baguettePath,
    baguetteLine1,
    baguetteLine2,
    baguetteLine3,
    leaf1Path,
    leaf2Path,
    stemPath,
  } = PATH_CACHE[size];

  return (
    <View style={componentStyles.container}>
      {!!showBrand && (
        <View style={componentStyles.brandContainer}>
          <Text
            style={[
              componentStyles.brandTitle,
              { color: theme.colors.textPrimary },
            ]}
          >
            Sous Chef
          </Text>
          <Text
            style={[
              componentStyles.brandSubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            Your Kitchen Assistant
          </Text>
        </View>
      )}

      <Canvas
        style={{
          width: config.canvas,
          height: config.canvas,
        }}
      >
        {/* Baguette (bounces independently) */}
        <Group transform={baguetteTransform}>
          <Path path={baguettePath} color={COLORS.baguette} />
          <Path
            path={baguetteLine1}
            color={COLORS.baguetteLines}
            style="stroke"
            strokeWidth={2 * scale}
          />
          <Path
            path={baguetteLine2}
            color={COLORS.baguetteLines}
            style="stroke"
            strokeWidth={2 * scale}
          />
          <Path
            path={baguetteLine3}
            color={COLORS.baguetteLines}
            style="stroke"
            strokeWidth={2 * scale}
          />
        </Group>

        {/* Tomato (bounces independently) */}
        <Group transform={tomatoTransform}>
          <Circle
            cx={cx + 5 * scale}
            cy={cy - 50 * scale}
            r={18 * scale}
            color={COLORS.tomato}
          />
          <Circle
            cx={cx + 2 * scale}
            cy={cy - 53 * scale}
            r={5 * scale}
            color={COLORS.tomatoHighlight}
            opacity={0.4}
          />
          {/* Tomato stem */}
          <Path path={stemPath} color={COLORS.tomatoStem} />
        </Group>

        {/* Leaves (bounce independently) */}
        <Group transform={leavesTransform}>
          <Path path={leaf1Path} color={COLORS.leaves} />
          <Path path={leaf2Path} color={COLORS.leavesDark} />
        </Group>

        {/* Paper Bag (static, in foreground to clip items) */}
        <Group>
          {/* Bag body */}
          <RoundedRect
            x={cx - 45 * scale}
            y={cy - 25 * scale}
            width={90 * scale}
            height={70 * scale}
            r={8 * scale}
            color={COLORS.bag}
          />
          {/* Bag top fold effect */}
          <RoundedRect
            x={cx - 48 * scale}
            y={cy - 30 * scale}
            width={96 * scale}
            height={12 * scale}
            r={4 * scale}
            color={COLORS.bagDark}
          />
        </Group>

        {/* Banner */}
        <Group>
          <RoundedRect
            x={cx - 55 * scale}
            y={cy + 25 * scale}
            width={110 * scale}
            height={28 * scale}
            r={14 * scale}
            color={COLORS.banner}
          />
        </Group>
      </Canvas>

      {/* Banner text (using React Native Text for better typography) */}
      <View
        style={[
          componentStyles.bannerTextContainer,
          {
            marginTop: -35 * scale,
            width: 110 * scale,
          },
        ]}
      >
        <Text
          style={[
            componentStyles.bannerText,
            {
              fontSize: theme.typography.fontSize['2xs'] * scale,
              color: COLORS.bannerText,
            },
          ]}
        >
          {message.toUpperCase()}
        </Text>
      </View>
    </View>
  );
};

// Convenience exports
export const SousChefLoaderSmall: React.FC<
  Omit<SousChefLoaderProps, 'size'>
> = props => <SousChefLoader size="small" {...props} />;

export const SousChefLoaderMedium: React.FC<
  Omit<SousChefLoaderProps, 'size'>
> = props => <SousChefLoader size="medium" {...props} />;

export const SousChefLoaderLarge: React.FC<
  Omit<SousChefLoaderProps, 'size'>
> = props => <SousChefLoader size="large" {...props} />;

const componentStyles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  brandTitle: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.bold,
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: theme.fonts.size.sm,
    marginTop: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  bannerTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  bannerText: {
    fontWeight: theme.fonts.weight.bold,
    letterSpacing: 3,
    textAlign: 'center',
  },
}));
