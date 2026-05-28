import { useApolloClient, useQuery } from '@apollo/client/react';
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
  const client = useApolloClient();
  const { data, loading, error, refetch } = useQuery(GetMealTemplateDocument, {
    variables: { id: templateId! },
    skip: !templateId,
  });

  const template = data?.mealTemplate ?? null;

  // Items arrive as masked refs — materialize so the grouping logic can read
  // `dayOffset` without bumping into `$fragmentRefs`. Use the cache-key form;
  // the masked-ref `from` silently returns partial/null data under dataMasking.
  const items: MealTemplateItemFragment[] = (template?.items ?? [])
    .map(ref =>
      client.cache.readFragment<MealTemplateItemFragment>({
        fragment: MealTemplateItemFragmentDoc,
        fragmentName: 'MealTemplateItemFragment',
        from: { __typename: 'MealTemplateItem', id: ref.id },
      }),
    )
    .filter((i): i is MealTemplateItemFragment => i !== null);

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
