import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from './SkeletonCircle';
import { SkeletonLine } from './SkeletonLine';
import { SkeletonRectangle } from './SkeletonRectangle';
import { ListItem } from '#/components/molecules/ListItem';
import { commonStyles } from '#/styles/commonStyles';

interface ShoppingListItemSkeletonProps {
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Shopping List Item Skeleton
 *
 * Specialized skeleton for shopping list items with checkbox, image, title, and quantity.
 * Reuses ListItem as wrapper to stay in sync with actual item styles.
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
  return (
    <View style={[styles.wrapper, commonStyles.shadow]}>
      <ListItem>
        <SkeletonCircle size={24} animated={animated} />
        <SkeletonRectangle width={44} height={44} borderRadius={8} animated={animated} />
        <View style={styles.content}>
          <SkeletonLine width="70%" height={16} style={styles.title} animated={animated} />
          <SkeletonLine width="40%" height={14} animated={animated} />
        </View>
        <SkeletonLine width={40} height={30} animated={animated} />
      </ListItem>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  wrapper: {
    borderRadius: theme.radii.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: theme.spacing.xs,
  },
}));
