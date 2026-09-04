import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';
import { SkeletonRectangle } from '#components/atoms/Skeleton/SkeletonRectangle';
import { ListItem } from '#components/molecules/ListItem';
import { commonStyles } from '#/styles/commonStyles';

interface RecipeItemSkeletonProps {
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Recipe Item Skeleton
 *
 * Skeleton for a single recipe list item. Reuses ListItem as wrapper
 * to stay in sync with actual item styles (height, padding, gap).
 */
export const RecipeItemSkeleton: React.FC<RecipeItemSkeletonProps> = ({
  animated = true,
}) => {
  return (
    <View style={[styles.wrapper, commonStyles.shadow]}>
      <ListItem>
        <SkeletonRectangle
          width={48}
          height={48}
          borderRadius={8}
          animated={animated}
        />
        <View style={styles.content}>
          <SkeletonLine width="70%" height={16} animated={animated} />
          <SkeletonLine width="50%" height={14} animated={animated} />
        </View>
      </ListItem>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  wrapper: {
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
}));
