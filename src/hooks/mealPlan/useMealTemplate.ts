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
  const items = template?.items ?? [];

  // Group items by day offset
  let groupedByDay: GroupedDay[] = [];
  if (items.length > 0) {
    const dayMap = new Map<number, MealTemplateItemFragment[]>();
    for (const item of items) {
      const existing = dayMap.get(item.dayOffset) ?? [];
      existing.push(item);
      dayMap.set(item.dayOffset, existing);
    }

    groupedByDay = Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayOffset, dayItems]) => ({ dayOffset, items: dayItems }));
  }

  return {
    template,
    items,
    groupedByDay,
    loading,
    error,
    refetch,
  };
}
