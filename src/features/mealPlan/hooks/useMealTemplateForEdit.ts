import { skipToken, useQuery } from '@apollo/client/react';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useDataState } from '#hooks/data/useDataState';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useLoadRemainingPages } from '#hooks/utils/useLoadRemainingPages';
import { GetMealTemplateForEditDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';

/** The template an edit session loads; undefined while creating a new one. */
export function useMealTemplateForEdit(templateId: string | undefined) {
  const { data, loading, error, observable, refetch } = useQuery(
    GetMealTemplateForEditDocument,
    templateId
      ? { variables: { id: templateId, itemsFirst: MEALS_PAGE_SIZE } }
      : skipToken,
  );
  const held = usePreservedQueryData(data, undefined, templateId ?? '');
  const template = held?.mealTemplate;
  const state = useDataState({
    loading,
    error,
    hasResult: held !== undefined,
    isEmpty: !template,
    skipped: !templateId,
  });

  // Every meal, not the first page: each row is edited on its own, so a meal
  // on an unread page is only missing from the list, never removed by a save.
  const meals = useConnectionData({
    data,
    selector: result => result.mealTemplate?.itemsConnection,
    key: templateId ?? '',
    loading,
    observable,
    cursorVariableName: 'itemsAfter',
    refetch,
  });
  useLoadRemainingPages(!!templateId, loading, meals, templateId ?? '');

  return { template, items: meals.items, state, refetch };
}
