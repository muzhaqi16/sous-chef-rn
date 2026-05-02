import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GetMealTemplatesDocument } from '../../graphql/operations/mealPlan/mealTemplate.generated';
import { type TemplateCategory } from '../../graphql/generated/schemaTypes';
import { type MealTemplateDisplayFragment } from '../../graphql/operations/mealPlan/mealPlanFragments.generated';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import type { HookReturn } from '#hooks/types';

interface UseMealTemplatesOptions {
  category?: TemplateCategory;
}

interface MealTemplatesState {
  templates: MealTemplateDisplayFragment[];
  loading: boolean;
  error: Error | undefined;
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

  return {
    state: {
      templates: connectionData.items as MealTemplateDisplayFragment[],
      loading,
      error: error as Error | undefined,
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
