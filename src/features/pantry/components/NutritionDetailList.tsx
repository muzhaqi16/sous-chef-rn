import React from 'react';
import { useTranslation } from '#/i18n';
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
} from '#domain/nutrition';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { EmptyState } from '#components/molecules/EmptyState';

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
  const { t } = useTranslation();
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
        <EmptyState size="compact" title={t('nutrition.noData')} />
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
          <Text role="label" tone="secondary">
            {t('nutrition.servingSize')}
          </Text>
          <Text role="label">{displayServingSize}</Text>
        </View>
      )}

      {/* Nutrient sections by category */}
      {categoryOrder.map(category => {
        const categoryEntries = groupedEntries[category];
        if (!categoryEntries || categoryEntries.length === 0) return null;

        return (
          <View key={category} style={styles.section}>
            <SectionHeader variant="overline" style={styles.sectionTitle}>
              {getCategoryLabel(category)}
            </SectionHeader>

            {categoryEntries.map((entry, index) => (
              <View
                key={entry.key}
                style={[
                  styles.row,
                  index === categoryEntries.length - 1 && styles.lastRow,
                ]}
              >
                <Text
                  role="caption"
                  tone="secondary"
                  style={styles.nutrientName}
                >
                  {entry.name}
                </Text>
                <Text role="label">
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
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  servingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary + '10',
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  section: {
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  lastRow: {
    borderBottomWidth: theme.borderWidth.none,
  },
  nutrientName: {
    flex: 1,
  },
}));
