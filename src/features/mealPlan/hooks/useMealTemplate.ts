import { skipToken, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useLoadRemainingPages } from '#hooks/utils/useLoadRemainingPages';
import { GetMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  MealTemplateItemFragmentDoc,
  type MealTemplateItemFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';

interface GroupedDay {
  dayOffset: number;
  items: MealTemplateItemFragment[];
}

export function useMealTemplate(templateId: string | undefined) {
  const { data, loading, error, refetch, fetchMore } = useQuery(
    GetMealTemplateDocument,
    templateId
      ? { variables: { id: templateId, itemsFirst: MEALS_PAGE_SIZE } }
      : skipToken,
  );

  // One cached list however many pages filled it; a template past the first
  // page reads the rest. Applying or copying it refuses unread pages
  // (`readTemplateSource`), so a page that fails only shortens the preview.
  const meals = useConnectionData({
    data,
    selector: result => result.mealTemplate?.itemsConnection,
    key: templateId ?? '',
    loading,
    fetchMore,
    cursorVariableName: 'itemsAfter',
    refetch,
  });
  useLoadRemainingPages(!!templateId, loading, meals, templateId ?? '');

  // Items arrive as masked refs, and moving one to another day edits only the
  // item — read each live so the grouping follows.
  const items = useFragmentList({
    fragment: MealTemplateItemFragmentDoc,
    fragmentName: 'MealTemplateItemFragment',
    from: meals.items,
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
