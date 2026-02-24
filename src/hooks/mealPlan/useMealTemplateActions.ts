import { useCallback } from 'react';
import {
  useCreateMealPlanFromTemplateMutation,
  useCreateTemplateFromMealPlanMutation,
  useDeleteMealTemplateMutation,
  useDuplicateTemplateMutation,
  GetMealTemplatesDocument,
  GetMealPlansDocument,
  type CreateMealPlanFromTemplateInput,
  type CreateTemplateFromMealPlanInput,
} from '#generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';

export function useMealTemplateActions() {
  const [createFromTemplateMutation, { loading: creatingFromTemplate }] =
    useCreateMealPlanFromTemplateMutation({
      refetchQueries: [{ query: GetMealPlansDocument }],
      onError: error => {
        toastService.error(error.message || 'Failed to create meal plan from template');
      },
    });

  const [createTemplateMutation, { loading: creatingTemplate }] =
    useCreateTemplateFromMealPlanMutation({
      refetchQueries: [{ query: GetMealTemplatesDocument }],
      onError: error => {
        toastService.error(error.message || 'Failed to save as template');
      },
    });

  const [deleteTemplateMutation, { loading: deleting }] =
    useDeleteMealTemplateMutation({
      refetchQueries: [{ query: GetMealTemplatesDocument }],
      onError: error => {
        toastService.error(error.message || 'Failed to delete template');
      },
    });

  const [duplicateTemplateMutation, { loading: duplicating }] =
    useDuplicateTemplateMutation({
      refetchQueries: [{ query: GetMealTemplatesDocument }],
      onError: error => {
        toastService.error(error.message || 'Failed to duplicate template');
      },
    });

  const createPlanFromTemplate = useCallback(
    async (input: CreateMealPlanFromTemplateInput) => {
      try {
        const result = await createFromTemplateMutation({
          variables: { input },
        });
        const data = result.data?.createMealPlanFromTemplate;
        if (data?.success) {
          toastService.success('Meal plan created from template!');
          Telemetry.trackEvent('meal_plan_created_from_template', {
            template_id: input.templateId,
          });
        }
        return data ?? null;
      } catch {
        return null;
      }
    },
    [createFromTemplateMutation],
  );

  const createTemplateFromPlan = useCallback(
    async (input: CreateTemplateFromMealPlanInput) => {
      try {
        const result = await createTemplateMutation({
          variables: { input },
        });
        const data = result.data?.createTemplateFromMealPlan;
        if (data?.success) {
          toastService.success('Meal plan saved as template!');
          Telemetry.trackEvent('template_created_from_meal_plan', {
            meal_plan_id: input.mealPlanId,
          });
        }
        return data ?? null;
      } catch {
        return null;
      }
    },
    [createTemplateMutation],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        const result = await deleteTemplateMutation({
          variables: { id },
        });
        const success = result.data?.deleteMealTemplate?.success ?? false;
        if (success) {
          toastService.success('Template deleted');
        }
        return success;
      } catch {
        return false;
      }
    },
    [deleteTemplateMutation],
  );

  const duplicateTemplate = useCallback(
    async (id: string, newName: string) => {
      try {
        const result = await duplicateTemplateMutation({
          variables: { id, newName },
        });
        const data = result.data?.duplicateTemplate;
        if (data?.success) {
          toastService.success('Template duplicated!');
        }
        return data ?? null;
      } catch {
        return null;
      }
    },
    [duplicateTemplateMutation],
  );

  return {
    createPlanFromTemplate,
    createTemplateFromPlan,
    deleteTemplate,
    duplicateTemplate,
    loading: creatingFromTemplate || creatingTemplate || deleting || duplicating,
    creatingFromTemplate,
    creatingTemplate,
    deleting,
    duplicating,
  };
}
