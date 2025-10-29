import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonLine } from './SkeletonLine';
import { SkeletonRectangle } from './SkeletonRectangle';

interface PantryItemSkeletonProps {
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Pantry Item Skeleton
 *
 * Specialized skeleton for pantry items with image, title, quantity, and expiry date.
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
  const styles = StyleSheet.create(theme => ({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      minHeight: 70,
    },
    image: {
      marginRight: theme.spacing.sm,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      marginBottom: theme.spacing.xs,
    },
    trailing: {
      alignItems: 'flex-end',
    },
    badge: {
      marginTop: theme.spacing.xs,
    },
  }));

  return (
    <View style={styles.container}>
      {/* Image placeholder */}
      <View style={styles.image}>
        <SkeletonRectangle width={60} height={60} borderRadius={8} animated={animated} />
      </View>

      {/* Content (title, quantity, expiry) */}
      <View style={styles.content}>
        <SkeletonLine width="70%" height={16} style={styles.title} animated={animated} />
        <SkeletonLine width="50%" height={14} style={styles.subtitle} animated={animated} />
        <SkeletonLine width="40%" height={12} animated={animated} />
      </View>

      {/* Trailing (quantity badge) */}
      <View style={styles.trailing}>
        <SkeletonRectangle width={60} height={24} borderRadius={12} animated={animated} />
      </View>
    </View>
  );
};
