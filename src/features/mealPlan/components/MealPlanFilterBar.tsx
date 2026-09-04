import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { parseISO } from 'date-fns';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { MealPlanType } from '#/graphql/generated/schemaTypes';
import { matchesTerm } from '#hooks/search/useLocalSearch';

export interface MealPlanFilterState {
  search: string;
  activeOnly: boolean;
  planType: MealPlanType | null;
}

export const EMPTY_MEAL_PLAN_FILTERS: MealPlanFilterState = {
  search: '',
  activeOnly: false,
  planType: null,
};

/**
 * Client-side filter for the plan selector list. Filtering the loaded set (not a
 * refetch) keeps the main calendar's selected plan stable and is instant — the
 * selector shows all of a user's plans, so pagination isn't a concern here.
 */
export function filterMealPlans<
  T extends {
    name: string;
    planType: MealPlanType;
    startDate: string;
    endDate: string;
  },
>(plans: T[], filters: MealPlanFilterState, now: Date): T[] {
  return plans.filter(plan => {
    if (!matchesTerm(plan, filters.search, ['name'])) return false;
    if (filters.planType && plan.planType !== filters.planType) return false;
    if (filters.activeOnly) {
      const start = parseISO(plan.startDate);
      const end = parseISO(plan.endDate);
      if (now < start || now > end) return false;
    }
    return true;
  });
}

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
