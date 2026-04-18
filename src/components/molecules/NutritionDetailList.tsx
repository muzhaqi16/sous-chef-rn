import React from 'react';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { NutritionsData, NutrientCategory } from '#/types/nutrition';
import {
  parseNutritions,
  getNutrientEntries,
  groupNutrientsByCategory,
  getCategoryLabel,
  formatNutritionValue,
  formatServingSize,
  hasNutritionData,
} from '#utils/nutritionUtils';
import { Text } from '#components/atoms/Text';

interface NutritionDetailListProps {
  /** Raw nutritions JSON from API or parsed NutritionsData */
  nutritions: unknown;
  /** Actual serving size in grams to scale values (optional) */
  actualServingGrams?: number | null;
  /** Container style */
  style?: ViewStyle;
}

export const NutritionDetailList: React.FC<NutritionDetailListProps> = ({
  nutritions: nutritionsRaw,
  actualServingGrams,
  style,
}) => {
  const nutritions =
    typeof nutritionsRaw === 'object' && nutritionsRaw !== null
      ? (nutritionsRaw as NutritionsData)
      : parseNutritions(nutritionsRaw);

  const entries = getNutrientEntries(nutritions, actualServingGrams);

  const groupedEntries = groupNutrientsByCategory(entries);

  // Display serving size - use actual if provided, otherwise use base
  const displayServingSize = actualServingGrams
    ? formatServingSize(actualServingGrams)
    : nutritions?.servingSize;

  if (!hasNutritionData(nutritions)) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <Text size="sm" tone="secondary" style={styles.emptyText}>
            No nutrition data available
          </Text>
        </View>
      </View>
    );
  }

  // Order categories for display
  const categoryOrder: NutrientCategory[] = [
    'macro',
    'vitamin',
    'mineral',
    'other',
  ];

  return (
    <View style={[styles.container, style]}>
      {/* Serving size header */}
      {!!displayServingSize && (
        <View style={styles.servingHeader}>
          <Text size="sm" weight="medium" tone="secondary">
            Serving Size
          </Text>
          <Text size="sm" weight="semibold">
            {displayServingSize}
          </Text>
        </View>
      )}

      {/* Nutrient sections by category */}
      {categoryOrder.map(category => {
        const categoryEntries = groupedEntries[category];
        if (!categoryEntries || categoryEntries.length === 0) return null;

        return (
          <View key={category} style={styles.section}>
            <Text size="sm" weight="semibold" style={styles.sectionTitle}>
              {getCategoryLabel(category)}
            </Text>

            {categoryEntries.map((entry, index) => (
              <View
                key={entry.key}
                style={[
                  styles.row,
                  index === categoryEntries.length - 1 && styles.lastRow,
                ]}
              >
                <Text size="sm" tone="secondary" style={styles.nutrientName}>
                  {entry.name}
                </Text>
                <Text size="sm" weight="medium">
                  {formatNutritionValue(entry.amount, entry.unit)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  servingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  nutrientName: {
    flex: 1,
  },
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontStyle: 'italic',
  },
}));
