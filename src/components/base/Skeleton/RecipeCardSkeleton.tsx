import React from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SkeletonLine } from './SkeletonLine';
import { SkeletonRectangle } from './SkeletonRectangle';

interface RecipeCardSkeletonProps {
  /**
   * Enable/disable shimmer animation
   * @default true
   */
  animated?: boolean;
}

/**
 * Recipe Card Skeleton Component
 *
 * Matches the layout of recipe search result items:
 * - Left image (recipe photo)
 * - Title
 * - Subtitle with details (ingredients, time, servings)
 * - Optional likes badge area
 */
export const RecipeCardSkeleton: React.FC<RecipeCardSkeletonProps> = ({
  animated = true,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      {/* Left: Recipe Image */}
      <View style={styles.imageContainer}>
        <SkeletonRectangle
          width={theme.sizes.listImage.width}
          height={theme.sizes.listImage.height}
          borderRadius={theme.radii.md}
          animated={animated}
        />
      </View>

      {/* Right: Recipe Details */}
      <View style={styles.content}>
        {/* Recipe Title */}
        <SkeletonLine width="85%" height={18} animated={animated} />

        {/* Recipe Details (ingredients, time, servings) */}
        <View style={styles.detailsRow}>
          <SkeletonLine width="95%" height={14} animated={animated} />
        </View>

        {/* Likes Badge Area */}
        <View style={styles.badgeArea}>
          <SkeletonLine width="30%" height={12} animated={animated} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  imageContainer: {
    // Image dimensions from recipe search layout
  },
  content: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  detailsRow: {
    marginTop: theme.spacing.xs,
  },
  badgeArea: {
    marginTop: theme.spacing.xs,
  },
}));
