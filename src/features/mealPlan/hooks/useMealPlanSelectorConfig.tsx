import React, { RefObject } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { format, parseISO } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import { SelectorItemContainer } from '#components/organisms/AnimatedItemSelector/SelectorItemContainer';
import { type MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';

interface UseMealPlanSelectorConfigOptions {
  mealPlans: MealPlanDisplayFragment[];
  selectedMealPlanId?: string | null;
  loading: boolean;
  setSelectedMealPlanId: (id: string) => void;
  selectorRef: RefObject<ItemSelectorRef | null>;
  toCreateMealPlan: () => void;
  onCreateFromTemplate: () => void;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
}

function formatPlanType(planType: string): string {
  return planType.charAt(0) + planType.slice(1).toLowerCase();
}

export function useMealPlanSelectorConfig(
  options: UseMealPlanSelectorConfigOptions,
): SelectorConfig<any> {
  const {
    mealPlans,
    selectedMealPlanId,
    loading,
    setSelectedMealPlanId,
    selectorRef,
    toCreateMealPlan,
    onCreateFromTemplate,
  } = options;

  const renderMealPlanItem = (
    item: MealPlanDisplayFragment,
    isSelected: boolean,
    onPress: () => void,
  ) => {
    return (
      <SelectorItemContainer
        state={isSelected ? 'selected' : 'default'}
        onPress={onPress}
      >
        <View style={styles.itemContent}>
          <Text size="md" weight="semibold">
            {item.name}
          </Text>
          <Text size="sm" tone="secondary" style={styles.itemSubtext}>
            {formatDateRange(item.startDate, item.endDate)} ·{' '}
            {formatPlanType(item.planType)}
            {` · ${item.home?.name ?? 'Personal'}`}
          </Text>
        </View>
        {!!isSelected && <Icon name="checkmark" size={20} tone="primary" />}
      </SelectorItemContainer>
    );
  };

  return {
    title: 'Select Meal Plan',
    data: mealPlans,
    selectedId: selectedMealPlanId ?? undefined,
    onSelect: (id: string) => {
      setSelectedMealPlanId(id);
      selectorRef.current?.close();
    },
    displayProperty: 'name',
    loading,
    emptyMessage: 'No meal plans available',
    renderCustomItem: renderMealPlanItem,
    actions: [
      {
        icon: 'add',
        label: 'Create New Plan',
        onPress: () => {
          selectorRef.current?.close();
          toCreateMealPlan();
        },
      },
      {
        icon: 'copy-outline',
        label: 'Create from Template',
        onPress: () => {
          selectorRef.current?.close();
          onCreateFromTemplate();
        },
      },
    ],
  };
}

const styles = StyleSheet.create(() => ({
  itemContent: {
    flex: 1,
  },
  itemSubtext: {
    marginTop: 2,
  },
}));
