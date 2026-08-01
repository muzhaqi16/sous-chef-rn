import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radii } from '#/theme/foundations/radii';
import { sizes } from '#/theme/foundations/sizes';
import { SkeletonLine } from './SkeletonLine';
import { SkeletonRectangle } from './SkeletonRectangle';

// Theme foundations (radii, sizes) are mode-invariant — they live in
// `commonTheme` and don't change between light/dark. Read them at module
// scope so this skeleton no longer needs `useUnistyles()`.
const IMAGE_SIZE = sizes.itemCard.compact.image;
const IMAGE_RADIUS = radii.md;

interface PantryItemSkeletonProps {
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Pantry Item Skeleton
 *
 * Matches the layout of PantryItemCard with image, title, subtitle, quantity, and location.
 *
 * @example
 * ```typescript
 * // While loading pantry
 * <FlatList
 *   data={[1, 2, 3, 4, 5]}
 *   renderItem={() => <PantryItemSkeleton />}
 * />
 * ```
 */
export const PantryItemSkeleton: React.FC<PantryItemSkeletonProps> = ({
  animated = true,
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.image}>
          <SkeletonRectangle
            width={IMAGE_SIZE}
            height={IMAGE_SIZE}
            borderRadius={IMAGE_RADIUS}
            animated={animated}
          />
        </View>

        {/* Content (title + subtitle) - matches CardContent */}
        <View style={styles.content}>
          <SkeletonLine
            width="70%"
            height={16}
            style={styles.title}
            animated={animated}
          />
          <SkeletonLine width="50%" height={13} animated={animated} />
        </View>

        {/* Right slot (quantity + location) - matches CardRightSlot meta type */}
        <View style={styles.trailing}>
          <SkeletonLine width={45} height={16} animated={animated} />
          <SkeletonLine
            width={40}
            height={11}
            style={styles.location}
            animated={animated}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  wrapper: {
    marginHorizontal: theme.spacing['3'],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 3,
        spreadDistance: 0,
        color: `${theme.colors.backgroundSecondary}0A`,
      },
    ],
  },
  image: {
    marginRight: theme.spacing['3'],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: theme.spacing.xs,
  },
  trailing: {
    alignItems: 'flex-end',
    marginLeft: theme.spacing['3'],
  },
  location: {
    marginTop: theme.spacing.xs,
  },
}));
