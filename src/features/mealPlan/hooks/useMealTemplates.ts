import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GetMealTemplatesDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import type { TemplateCategory } from '#/graphql/generated/schemaTypes';
import type { FragmentType } from '@apollo/client/masking';
import type { MealTemplateDisplayFragmentDoc } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useDebouncedValue } from '#hooks/utils/useDebouncedValue';
import type { HookReturn } from '#hooks/types';

interface UseMealTemplatesOptions {
  category?: TemplateCategory;
}

/** A template row as the query holds it; `TemplateCard` reads its fields. */
export type MealTemplateRef = FragmentType<
  typeof MealTemplateDisplayFragmentDoc
> & { id: string };

interface MealTemplatesState {
  templates: MealTemplateRef[];
  loading: boolean;
  error: Error | undefined;
  /**
   * `data !== undefined` — a response arrived, empty or not. `search` and
   * `category` are live controls, so every combination is its own cache entry
   * and the first offline touch is a guaranteed miss; `useDataState` turns that
   * into "we don't know" rather than "there are none".
   */
  hasResult: boolean;
  hasMore: boolean;
  searchQuery: string;
  selectedCategory: TemplateCategory | undefined;
}

interface MealTemplatesActions {
  refetch: () => void;
  loadMore: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: TemplateCategory | undefined) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

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

  // Each keystroke would otherwise be its own query and cache entry.
  const search = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);

  const { data, loading, error, refetch, fetchMore } = useQuery(
    GetMealTemplatesDocument,
    {
      variables: {
        filters: {
          category: selectedCategory,
          search: search || undefined,
        },
        first: 20,
      },
    },
  );

  const connectionData = useConnectionData({
    data,
    selector: d => d.mealTemplates,
    key: JSON.stringify([selectedCategory ?? null, search]),
    loading,
    fetchMore,
    refetch,
  });

  const templates: MealTemplateRef[] = connectionData.items;

  return {
    state: {
      templates,
      loading,
      error: error,
      // `data !== undefined` — a response arrived, empty or not.
      hasResult: data !== undefined,
      hasMore: connectionData.hasMore,
      searchQuery,
      selectedCategory,
    },
    actions: {
      refetch: () => {
        void refetch();
      },
      loadMore: connectionData.loadMore,
      setSearchQuery,
      setSelectedCategory,
    },
  };
}
