import { skipToken, useQuery } from '@apollo/client/react';
import { GetMealTemplateForEditDocument } from '#features/mealPlan/graphql/mealTemplate.generated';

/** The template an edit session loads; undefined while creating a new one. */
export function useMealTemplateForEdit(templateId: string | undefined) {
  const { data } = useQuery(
    GetMealTemplateForEditDocument,
    templateId ? { variables: { id: templateId } } : skipToken,
  );

  return { template: data?.mealTemplate };
}
