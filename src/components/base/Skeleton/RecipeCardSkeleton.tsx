import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonLine } from './SkeletonLine';
import { SkeletonRectangle } from './SkeletonRectangle';
import { ListItem } from '#/components/molecules/ListItem';
import { commonStyles } from '#/styles/commonStyles';

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
 * Matches the layout of recipe search result items rendered via ItemCard → ListItem.
 * Wraps in ListItem for automatic style sync (height, padding, gap).
 */
export const RecipeCardSkeleton: React.FC<RecipeCardSkeletonProps> = ({
  animated = true,
}) => {
  return (
    <View style={[styles.wrapper, commonStyles.shadow]}>
      <ListItem>
        <SkeletonRectangle width={48} height={48} borderRadius={8} animated={animated} />
        <View style={styles.content}>
          <SkeletonLine width="85%" height={16} animated={animated} />
          <SkeletonLine width="60%" height={14} animated={animated} />
        </View>
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
    gap: theme.spacing.xs,
  },
}));
