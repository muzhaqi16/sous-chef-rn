import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GetMealTemplatesDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { type TemplateCategory } from '#/graphql/generated/schemaTypes';
import { type MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useOfflineAwareError } from '#hooks/app/useOfflineAwareError';
import type { HookReturn } from '#hooks/types';

interface UseMealTemplatesOptions {
  category?: TemplateCategory;
}

interface MealTemplatesState {
  templates: MealTemplateDisplayFragment[];
  loading: boolean;
  error: Error | undefined;
  /**
   * No network was attempted and nothing was cached for the current search and
   * category. Distinct from an empty result — the list being blank here means
   * "we don't know", not "there are none".
   */
  offline: boolean;
  hasMore: boolean;
  totalCount: number | undefined;
  searchQuery: string;
  selectedCategory: TemplateCategory | undefined;
}

interface MealTemplatesActions {
  refetch: () => void;
  loadMore: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: TemplateCategory | undefined) => void;
}

type UseMealTemplatesResult = HookReturn<
  MealTemplatesState,
  MealTemplatesActions
>;

export function useMealTemplates(
  options: UseMealTemplatesOptions = {},
): UseMealTemplatesResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | undefined
  >(options.category);

  const { data, loading, error, refetch, fetchMore } = useQuery(
    GetMealTemplatesDocument,
    {
      variables: {
        filters: {
          category: selectedCategory,
          search: searchQuery.trim() || undefined,
        },
        first: 20,
      },
    },
  );

  const connectionData = useConnectionData({
    data,
    selector: d => d.mealTemplates,
    loading,
    fetchMore,
  });

  // `search` and `category` are live controls, so every combination is its own
  // cache entry — offline, the first search is a guaranteed miss. Without this
  // the sheet would claim "no templates found", which is a different statement
  // from "we couldn't check".
  const templates = connectionData.items as MealTemplateDisplayFragment[];
  const classified = useOfflineAwareError(
    error as Error | undefined,
    templates.length > 0,
  );

  return {
    state: {
      templates,
      loading,
      error: classified.error,
      offline: classified.offline,
      hasMore: connectionData.hasMore,
      totalCount: connectionData.totalCount,
      searchQuery,
      selectedCategory,
    },
    actions: {
      refetch,
      loadMore: connectionData.loadMore,
      setSearchQuery,
      setSelectedCategory,
    },
  };
}
