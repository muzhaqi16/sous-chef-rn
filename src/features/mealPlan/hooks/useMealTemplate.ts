import { skipToken, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { GetMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  MealTemplateItemFragmentDoc,
  type MealTemplateItemFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';

interface GroupedDay {
  dayOffset: number;
  items: MealTemplateItemFragment[];
}

export function useMealTemplate(templateId: string | undefined) {
  const { data, loading, error, refetch } = useQuery(
    GetMealTemplateDocument,
    templateId ? { variables: { id: templateId } } : skipToken,
  );

  const template = data?.mealTemplate ?? null;

  // Items arrive as masked refs, and moving one to another day edits only the
  // item — read each live so the grouping follows.
  const items = useFragmentList({
    fragment: MealTemplateItemFragmentDoc,
    fragmentName: 'MealTemplateItemFragment',
    from: template?.items ?? [],
  }).filter((i): i is MealTemplateItemFragment => i !== null);

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
    groupedByDay,
    loading,
    error,
    hasResult: data !== undefined,
    refetch: () => {
      void refetch();
    },
  };
}
