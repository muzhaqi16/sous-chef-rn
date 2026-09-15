import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { MealPlanType } from '#/graphql/generated/schemaTypes';
import type { MealPlanFilterState } from '#features/mealPlan/utils/mealPlanFilters';

/** A pill toggle used for the active-only + plan-type filters. */
const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => {
  styles.useVariants({ active });
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text role="label" tone={active ? 'inverse' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
};

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
      <ThemedBottomSheetTextInput
        value={filters.search}
        onChangeText={search => onChange({ ...filters, search })}
        placeholder={t('mealPlanSelector.searchPlaceholder')}
        style={styles.search}
      />
      <View style={styles.chipRow}>
        <FilterChip
          label={t('mealPlanSelector.filterActive')}
          active={filters.activeOnly}
          onPress={() =>
            onChange({ ...filters, activeOnly: !filters.activeOnly })
          }
        />
        <FilterChip
          label={t('mealPlan.weekly')}
          active={filters.planType === MealPlanType.Weekly}
          onPress={() => togglePlanType(MealPlanType.Weekly)}
        />
        <FilterChip
          label={t('mealPlan.monthly')}
          active={filters.planType === MealPlanType.Monthly}
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
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    variants: {
      active: {
        true: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
      },
    },
  },
}));
