import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonBase } from '#components/atoms/Skeleton/SkeletonBase';
import { MealPlanItemCardSkeleton } from '#features/mealPlan/components/skeletons/MealPlanItemCardSkeleton';

/** Mirrors MealPlanMain's loaded layout, section for section. */
export const MealPlanSkeleton: React.FC = () => (
  <ScrollView
    contentContainerStyle={styles.container}
    showsVerticalScrollIndicator={false}
  >
    {/* WeekStrip skeleton */}
    <View style={styles.weekStrip}>
      {/* Left arrow */}
      <View style={styles.arrowButton}>
        <SkeletonBase width={16} height={16} borderRadius={4} />
      </View>

      {/* 7 day cells */}
      <View style={styles.daysRow}>
        {Array.from({ length: 7 }, (_, index) => (
          <View
            key={index}
            style={[styles.dayItem, index === 2 && styles.dayItemSelected]}
          >
            <SkeletonBase
              width={20}
              height={12}
              borderRadius={3}
              style={index === 2 ? styles.selectedBone : undefined}
            />
            <View style={styles.dayNumberGap} />
            <SkeletonBase
              width={16}
              height={16}
              borderRadius={3}
              style={index === 2 ? styles.selectedBone : undefined}
            />
          </View>
        ))}
      </View>

      {/* Right arrow */}
      <View style={styles.arrowButton}>
        <SkeletonBase width={16} height={16} borderRadius={4} />
      </View>
    </View>

    {/* CalendarToggleBar skeleton */}
    <View style={styles.toggleBar}>
      <View style={styles.toggleLine} />
      <SkeletonBase width={16} height={16} borderRadius={8} />
      <View style={styles.toggleLine} />
    </View>

    {/* Nutrition summary header skeleton */}
    <View style={styles.nutritionHeader}>
      <SkeletonBase width={140} height={16} borderRadius={4} />
      <SkeletonBase width={80} height={14} borderRadius={4} />
    </View>

    {/* Day summary skeleton */}
    <View style={styles.daySummary}>
      <SkeletonBase width={130} height={16} borderRadius={4} />
    </View>

    {/* Meal section 1 (e.g. Breakfast) */}
    <View style={styles.mealSection}>
      <View style={styles.sectionHeader}>
        <SkeletonBase width={60} height={16} borderRadius={4} />
        <SkeletonBase width={20} height={20} borderRadius={10} />
      </View>
      <MealPlanItemCardSkeleton />
      <MealPlanItemCardSkeleton />
    </View>

    {/* Meal section 2 (e.g. Lunch) */}
    <View style={styles.mealSection}>
      <View style={styles.sectionHeader}>
        <SkeletonBase width={60} height={16} borderRadius={4} />
        <SkeletonBase width={20} height={20} borderRadius={10} />
      </View>
      <MealPlanItemCardSkeleton />
    </View>
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  container: {
    paddingBottom: 120,
  },

  // WeekStrip
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  arrowButton: {
    padding: theme.spacing.xs,
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayItem: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    minWidth: 40,
  },
  dayItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayNumberGap: {
    height: 2,
  },
  selectedBone: {
    opacity: 0.5,
  },

  // CalendarToggleBar
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  toggleLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
    maxWidth: 80,
  },

  // Nutrition summary header
  nutritionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },

  // Day summary
  daySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },

  // Meal sections
  mealSection: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
}));
