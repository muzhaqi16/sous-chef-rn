import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedTextInput } from '#components/atoms/themedComponents';
import { Chip } from '#components/molecules/Chip';
import { MealPlanType } from '#graphql/generated/schemaTypes';
import type { MealPlanFilterState } from '#features/mealPlan/utils/mealPlanFilters';

interface MealPlanFilterBarProps {
  filters: MealPlanFilterState;
  onChange: (next: MealPlanFilterState) => void;
}

export const MealPlanFilterBar: React.FC<MealPlanFilterBarProps> = ({
  filters,
  onChange,
}) => {
  const { t } = useTranslation();

  const togglePlanType = (planType: MealPlanType) =>
    onChange({
      ...filters,
      planType: filters.planType === planType ? null : planType,
    });

  return (
    <View style={styles.container}>
      <ThemedTextInput
        value={filters.search}
        onChangeText={search => onChange({ ...filters, search })}
        placeholder={t('mealPlanSelector.searchPlaceholder')}
        style={styles.search}
      />
      <View style={styles.chipRow}>
        <Chip
          label={t('mealPlanSelector.filterActive')}
          selected={filters.activeOnly}
          onPress={() =>
            onChange({ ...filters, activeOnly: !filters.activeOnly })
          }
        />
        <Chip
          label={t('mealPlan.weekly')}
          selected={filters.planType === MealPlanType.Weekly}
          onPress={() => togglePlanType(MealPlanType.Weekly)}
        />
        <Chip
          label={t('mealPlan.monthly')}
          selected={filters.planType === MealPlanType.Monthly}
          onPress={() => togglePlanType(MealPlanType.Monthly)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  search: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    ...theme.type.body,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
}));
