import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonBase } from '#components/atoms/Skeleton/SkeletonBase';
import { MealPlanItemCardSkeleton } from '#features/mealPlan/components/skeletons/MealPlanItemCardSkeleton';
import { getScrollClearancePadding } from '#constants/layout';
import { Icon } from '#utils/iconUtils';

/** Mirrors MealPlanMain's fixed calendar and scrolling meal sections. */
export const MealPlanSkeleton: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.weekStrip}>
      <View style={styles.arrowButton}>
        <Icon name="chevron-back" size="sm" tone="border" />
      </View>

      <View style={styles.daysRow}>
        {Array.from({ length: 7 }, (_, index) => (
          <View
            key={index}
            style={[styles.dayItem, index === 2 && styles.dayItemSelected]}
          >
            <View style={styles.dayLabelLine}>
              <SkeletonBase
                width={20}
                height={12}
                borderRadius={3}
                style={index === 2 ? styles.selectedBone : undefined}
              />
            </View>
            <View style={styles.dayNumberLine}>
              <SkeletonBase
                width={16}
                height={16}
                borderRadius={3}
                style={index === 2 ? styles.selectedBone : undefined}
              />
            </View>
            {index === 2 && <View style={styles.mealDot} />}
          </View>
        ))}
      </View>

      <View style={styles.arrowButton}>
        <Icon name="chevron-forward" size="sm" tone="border" />
      </View>
    </View>

    <View style={styles.toggleBar}>
      <View style={styles.toggleLine} />
      <Icon name="chevron-down" size="xs" tone="border" />
      <View style={styles.toggleLine} />
    </View>

    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.nutritionHeader}>
        <View style={styles.headingLine}>
          <SkeletonBase width={140} height={16} borderRadius={4} />
        </View>
        <View style={styles.nutritionHeaderRight}>
          <SkeletonBase width={80} height={14} borderRadius={4} />
          <Icon name="chevron-down" size="sm" tone="border" />
        </View>
      </View>

      {Array.from({ length: 4 }, (_, sectionIndex) => (
        <View key={sectionIndex} style={styles.mealSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.headingLine}>
              <SkeletonBase width={60} height={16} borderRadius={4} />
            </View>
            <SkeletonBase width={20} height={20} borderRadius={10} />
          </View>
          <MealPlanItemCardSkeleton />
        </View>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    // Match DayMealList's gutter; the fixed calendar above spans the screen.
    paddingHorizontal: theme.layout.pageGutter,
    paddingBottom: getScrollClearancePadding(rt.insets.bottom),
  },
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
  dayLabelLine: {
    minHeight: theme.type.label.lineHeight,
    justifyContent: 'center',
    marginBottom: 2,
  },
  dayNumberLine: {
    minHeight: theme.type.bodyStrong.lineHeight,
    justifyContent: 'center',
  },
  selectedBone: {
    backgroundColor: theme.colors.onPrimary,
    opacity: 0.5,
  },
  mealDot: {
    width: 5,
    height: 5,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    marginTop: 3,
  },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  toggleLine: {
    flex: 1,
    height: theme.borderWidth.hairline,
    backgroundColor: theme.colors.border,
    maxWidth: 80,
  },
  nutritionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  nutritionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  headingLine: {
    minHeight: theme.type.bodyStrong.lineHeight,
    justifyContent: 'center',
  },
  mealSection: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
}));
