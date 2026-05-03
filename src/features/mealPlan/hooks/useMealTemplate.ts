import { useQuery } from '@apollo/client/react';
import { GetMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { type MealTemplateItemFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';

interface GroupedDay {
  dayOffset: number;
  items: MealTemplateItemFragment[];
}

export function useMealTemplate(templateId: string | undefined) {
  const { data, loading, error, refetch } = useQuery(GetMealTemplateDocument, {
    variables: { id: templateId! },
    skip: !templateId,
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
