import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from './SkeletonCircle';
import { SkeletonLine } from './SkeletonLine';
import { SkeletonRectangle } from './SkeletonRectangle';

interface ShoppingListItemSkeletonProps {
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Shopping List Item Skeleton
 *
 * Specialized skeleton for shopping list items with checkbox, image, title, and quantity.
 *
 * @example
 * ```typescript
 * // While loading shopping list
 * <FlatList
 *   data={[1, 2, 3, 4, 5]}
 *   renderItem={() => <ShoppingListItemSkeleton />}
 * />
 * ```
 */
export const ShoppingListItemSkeleton: React.FC<ShoppingListItemSkeletonProps> = ({
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
    checkbox: {
      marginRight: theme.spacing.sm,
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
    quantity: {
      marginLeft: theme.spacing.sm,
      alignItems: 'center',
    },
  }));

  return (
    <View style={styles.container}>
      {/* Checkbox placeholder */}
      <View style={styles.checkbox}>
        <SkeletonCircle size={24} animated={animated} />
      </View>

      {/* Image placeholder */}
      <View style={styles.image}>
        <SkeletonRectangle width={44} height={44} borderRadius={8} animated={animated} />
      </View>

      {/* Content (title and category) */}
      <View style={styles.content}>
        <SkeletonLine width="70%" height={16} style={styles.title} animated={animated} />
        <SkeletonLine width="40%" height={14} animated={animated} />
      </View>

      {/* Quantity placeholder */}
      <View style={styles.quantity}>
        <SkeletonLine width={40} height={30} animated={animated} />
      </View>
    </View>
  );
};
