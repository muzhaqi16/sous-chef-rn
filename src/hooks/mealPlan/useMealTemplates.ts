import { useState } from 'react';
import {
  useGetMealTemplatesQuery,
  type TemplateCategory,
  type MealTemplateDisplayFragment } from '#generated';
import { extractNodes } from '#/utils/connectionUtils';

interface UseMealTemplatesOptions {
  category?: TemplateCategory;
}

export function useMealTemplates(options: UseMealTemplatesOptions = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | undefined
  >(options.category);

  const { data, loading, error, refetch, fetchMore } =
    useGetMealTemplatesQuery({
      variables: {
        filters: {
          category: selectedCategory,
          search: searchQuery.trim() || undefined },
        first: 20 },
      fetchPolicy: 'cache-and-network' });

  const templates = extractNodes(data?.mealTemplates) as MealTemplateDisplayFragment[];

  const pageInfo = data?.mealTemplates?.pageInfo;
  const totalCount = data?.mealTemplates?.totalCount ?? 0;

  const loadMore = () => {
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) return;
    fetchMore({
      variables: { after: pageInfo.endCursor } });
  };

  return {
    templates,
    loading,
    error,
    refetch,
    loadMore,
    hasMore: pageInfo?.hasNextPage ?? false,
    totalCount,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory };
}
