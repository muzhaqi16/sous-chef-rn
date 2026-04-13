import { useState } from 'react';
import {
  useGetMealTemplatesQuery,
  type TemplateCategory,
  type MealTemplateDisplayFragment,
} from '#generated';
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

  const { data, loading, error, refetch, fetchMore } = useGetMealTemplatesQuery(
    {
      variables: {
        filters: {
          category: selectedCategory,
          search: searchQuery.trim() || undefined,
        },
        first: 20,
      },
      fetchPolicy: 'cache-and-network',
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
