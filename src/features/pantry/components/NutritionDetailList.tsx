import React from 'react';
import { useTranslation } from '#/i18n';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { NutrientCategory } from '#/types/nutrition';
import {
  type NutritionFactsValues,
  getNutrientEntries,
  groupNutrientsByCategory,
  getCategoryLabel,
  formatNutritionValue,
  formatServing,
  hasNutritionData,
} from '#domain/nutrition';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { EmptyState } from '#components/molecules/EmptyState';

interface NutritionDetailListProps {
  nutritionFacts: NutritionFactsValues | null;
  /** Container style */
  style?: ViewStyle;
}

export const NutritionDetailList: React.FC<NutritionDetailListProps> = ({
  nutritionFacts,
  style,
}) => {
  const { t } = useTranslation();

  if (!hasNutritionData(nutritionFacts)) {
    return (
      <View style={[styles.container, style]}>
        <EmptyState size="compact" title={t('nutrition.noData')} />
      </View>
    );
  }

  const groupedEntries = groupNutrientsByCategory(
    getNutrientEntries(nutritionFacts, t),
  );
  const displayServingSize = formatServing(nutritionFacts);

  // Order categories for display
  const categoryOrder: NutrientCategory[] = ['macro', 'vitamin', 'mineral'];

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
              {getCategoryLabel(category, t)}
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
