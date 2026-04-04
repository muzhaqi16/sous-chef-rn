import React, { RefObject } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { format, parseISO } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import type { MealPlanDisplayFragment } from '#generated';

interface UseMealPlanSelectorConfigOptions {
  mealPlans: MealPlanDisplayFragment[];
  selectedMealPlanId?: string | null;
  loading: boolean;
  setSelectedMealPlanId: (id: string) => void;
  selectorRef: RefObject<ItemSelectorRef | null>;
  navigate: (screen: string, params?: object) => void;
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
    navigate,
    onCreateFromTemplate,
  } = options;

  const {
    theme: { colors },
  } = useUnistyles();

  const renderMealPlanItem = (
    item: MealPlanDisplayFragment,
    isSelected: boolean,
    onPress: () => void,
  ) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.itemContainer,
          isSelected && styles.itemSelected,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
      >
        <View style={styles.itemContent}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSubtext}>
            {formatDateRange(item.startDate, item.endDate)} ·{' '}
            {formatPlanType(item.planType)}
            {` · ${item.home?.name ?? 'Personal'}`}
          </Text>
        </View>
        {!!isSelected && (
          <Icon name="checkmark" size={20} color={colors.primary} />
        )}
      </Pressable>
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
          navigate('CreateMealPlan');
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

const styles = StyleSheet.create(theme => ({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  itemSubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
