import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonBase } from './SkeletonBase';

/**
 * Skeleton for a single meal plan item card.
 * Matches MealPlanItemCard layout: checkbox → image → content → delete icon.
 */
export const MealPlanItemCardSkeleton: React.FC = () => (
  <View style={styles.card}>
    {/* Checkbox */}
    <View style={styles.checkbox}>
      <SkeletonBase width={24} height={24} borderRadius={12} />
    </View>

    {/* Image */}
    <View style={styles.image}>
      <SkeletonBase
        width={44}
        height={44}
        borderRadius={styles.imageBorderRadius.borderRadius}
      />
    </View>

    {/* Content */}
    <View style={styles.content}>
      <SkeletonBase width="70%" height={16} borderRadius={4} />
      <View style={styles.meta}>
        <SkeletonBase width="50%" height={14} borderRadius={4} />
      </View>
    </View>

    {/* Delete icon */}
    <SkeletonBase width={20} height={20} borderRadius={10} />
  </View>
);

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.xs,
  },
  checkbox: {
    marginRight: theme.spacing.sm,
  },
  image: {
    marginRight: theme.spacing.sm,
  },
  imageBorderRadius: {
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  content: {
    flex: 1,
  },
  meta: {
    marginTop: 2,
  },
}));
