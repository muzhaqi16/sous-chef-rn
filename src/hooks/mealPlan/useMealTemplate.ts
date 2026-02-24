import { useMemo } from 'react';
import {
  useGetMealTemplateQuery,
  type MealTemplateItemFragment,
} from '#generated';

interface GroupedDay {
  dayOffset: number;
  items: MealTemplateItemFragment[];
}

export function useMealTemplate(templateId: string | undefined) {
  const { data, loading, error, refetch } = useGetMealTemplateQuery({
    variables: { id: templateId! },
    skip: !templateId,
    fetchPolicy: 'cache-and-network',
  });

  const template = data?.mealTemplate ?? null;
  const items = useMemo(() => template?.items ?? [], [template?.items]);

  // Group items by day offset
  const groupedByDay = useMemo((): GroupedDay[] => {
    if (items.length === 0) return [];

    const dayMap = new Map<number, MealTemplateItemFragment[]>();
    for (const item of items) {
      const existing = dayMap.get(item.dayOffset) ?? [];
      existing.push(item);
      dayMap.set(item.dayOffset, existing);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayOffset, dayItems]) => ({ dayOffset, items: dayItems }));
  }, [items]);

  return {
    template,
    items,
    groupedByDay,
    loading,
    error,
    refetch,
  };
}
