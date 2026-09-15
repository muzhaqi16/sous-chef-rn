import type { RefObject } from 'react';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { MEAL_PLAN_TYPE_LABEL_KEYS } from '#features/mealPlan/utils/mealPlanEnumLabels';
import { StyleSheet } from 'react-native-unistyles';
import { parseISO } from 'date-fns';
import { formatDateRange } from '#/utils/formatters/date';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import { SelectorItemContainer } from '#components/organisms/AnimatedItemSelector/SelectorItemContainer';
import type { MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { useDebouncedValue } from '#hooks/utils/useDebouncedValue';
import { useMealPlanList } from '#features/mealPlan/hooks/useMealPlans';
import {
  filterMealPlans,
  hasMealPlanFilter,
  toMealPlanServerFilters,
  type MealPlanFilterState,
} from '#features/mealPlan/utils/mealPlanFilters';

const SEARCH_DEBOUNCE_MS = 300;

interface MealPlanPages {
  mealPlans: MealPlanDisplayFragment[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

interface UseMealPlanSelectorConfigOptions {
  /** The unfiltered plan list, as far as it has been paged. */
  plans: MealPlanPages;
  filters: MealPlanFilterState;
  selectedMealPlanId?: string | null;
  loading: boolean;
  setSelectedMealPlanId: (id: string) => void;
  selectorRef: RefObject<ItemSelectorRef | null>;
  toCreateMealPlan: () => void;
  onCreateFromTemplate: () => void;
  onCreateTemplate: () => void;
  // Filter UI rendered above the plan list (search + type/active chips).
  listHeader?: React.ReactNode;
}

function formatPlanDateRange(startDate: string, endDate: string): string {
  return formatDateRange(parseISO(startDate), parseISO(endDate));
}

export function useMealPlanSelectorConfig(
  options: UseMealPlanSelectorConfigOptions,
): SelectorConfig<MealPlanDisplayFragment> {
  const { t } = useTranslation();
  const {
    plans,
    filters,
    selectedMealPlanId,
    loading,
    setSelectedMealPlanId,
    selectorRef,
    toCreateMealPlan,
    onCreateFromTemplate,
    onCreateTemplate,
    listHeader,
  } = options;
  const personalLabel = t('mealPlanSelector.personalSubtitle');

  // A filter runs on the server so it reaches every plan, not the loaded pages.
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);
  const serverFilters = toMealPlanServerFilters({
    ...filters,
    search: debouncedSearch,
  });
  const filtered = useMealPlanList(serverFilters, { skip: !serverFilters });
  const isFiltering = hasMealPlanFilter(filters);

  // Until the variant for THESE filters answers (typing, first fetch, offline)
  // the loaded pages stand in. The client pass also drops what a local create
  // wrote into a variant it does not match.
  const source: MealPlanPages =
    isFiltering && filtered.hasResult && debouncedSearch === filters.search
      ? filtered
      : plans;
  const mealPlans = isFiltering
    ? filterMealPlans(source.mealPlans, filters, new Date())
    : plans.mealPlans;

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
          <Text role="bodyStrong">{item.name}</Text>
          <Text role="caption" tone="secondary" style={styles.itemSubtext}>
            {formatPlanDateRange(item.startDate, item.endDate)} ·{' '}
            {t(MEAL_PLAN_TYPE_LABEL_KEYS[item.planType])}
            {` · ${item.home?.name ?? personalLabel}`}
          </Text>
        </View>
        {!!isSelected && <Icon name="checkmark" size={20} tone="primary" />}
      </SelectorItemContainer>
    );
  };

  return {
    title: t('mealPlanSelector.title'),
    data: mealPlans,
    selectedId: selectedMealPlanId ?? undefined,
    onSelect: (id: string) => {
      setSelectedMealPlanId(id);
      selectorRef.current?.close();
    },
    displayProperty: 'name',
    loading,
    pagination: {
      hasMore: source.hasMore,
      loadingMore: source.loadingMore,
      onLoadMore: () => {
        void source.loadMore();
      },
      loadMoreLabel: t('mealPlanSelector.loadMore'),
    },
    emptyMessage: t('mealPlanSelector.emptyMessage'),
    listHeader,
    renderCustomItem: renderMealPlanItem,
    actions: [
      {
        icon: 'add',
        label: t('labels.create'),
        onPress: () => {
          selectorRef.current?.close();
          toCreateMealPlan();
        },
      },
      {
        icon: 'copy-outline',
        label: t('mealPlanSelector.createFromTemplate'),
        onPress: () => {
          selectorRef.current?.close();
          onCreateFromTemplate();
        },
      },
      {
        icon: 'construct-outline',
        label: t('labels.newTemplate'),
        onPress: () => {
          selectorRef.current?.close();
          onCreateTemplate();
        },
      },
    ],
  };
}

const styles = StyleSheet.create(theme => ({
  itemContent: {
    flex: 1,
  },
  itemSubtext: {
    marginTop: theme.spacing['2xs'],
  },
}));
