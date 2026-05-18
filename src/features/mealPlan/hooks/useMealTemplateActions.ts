import { useMutation } from '@apollo/client/react';
import {
  CreateMealPlanFromTemplateDocument,
  CreateTemplateFromMealPlanDocument,
  DeleteMealTemplateDocument,
  DuplicateTemplateDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  type CreateMealPlanFromTemplateInput,
  type CreateTemplateFromMealPlanInput,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

const addToMealPlans = createAddToQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);
const addToMealTemplates = createAddToQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);
const removeFromMealTemplates = createRemoveFromQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

export function useMealTemplateActions() {
  const [createFromTemplateMutation, { loading: creatingFromTemplate }] =
    useMutation(CreateMealPlanFromTemplateDocument, {
      update: (cache, { data }) => {
        const plan = data?.createMealPlanFromTemplate?.mealPlan;
        if (plan) {
          addToMealPlans(cache, plan, { position: 'start' });
        }
      },
      onError: error => {
        toastService.error(
          error.message || 'Failed to create meal plan from template',
        );
      },
    });

  const [createTemplateMutation, { loading: creatingTemplate }] = useMutation(
    CreateTemplateFromMealPlanDocument,
    {
      update: (cache, { data }) => {
        const template = data?.createTemplateFromMealPlan?.mealTemplate;
        if (template) {
          addToMealTemplates(cache, template, { position: 'start' });
        }
      },
      onError: error => {
        toastService.error(error.message || 'Failed to save as template');
      },
    },
  );

  const [deleteTemplateMutation, { loading: deleting }] = useMutation(
    DeleteMealTemplateDocument,
    {
      update: (cache, { data }, { variables }) => {
        if (!data?.deleteMealTemplate?.success || !variables?.id) return;
        removeFromMealTemplates(cache, variables.id, { evictItem: true });
      },
      onError: error => {
        toastService.error(error.message || 'Failed to delete template');
      },
    },
  );

  const [duplicateTemplateMutation, { loading: duplicating }] = useMutation(
    DuplicateTemplateDocument,
    {
      update: (cache, { data }) => {
        const template = data?.duplicateTemplate?.mealTemplate;
        if (template) {
          addToMealTemplates(cache, template, { position: 'start' });
        }
      },
      onError: error => {
        toastService.error(error.message || 'Failed to duplicate template');
      },
    },
  );

  const createPlanFromTemplate = async (
    input: CreateMealPlanFromTemplateInput,
  ) => {
    const result = await executeMutation(
      () => createFromTemplateMutation({ variables: { input } }),
      'Create meal plan from template error:',
    );
    if (!result) return null;
    const data = result.data?.createMealPlanFromTemplate;
    if (data?.success) {
      toastService.success('Meal plan created from template!');
      Telemetry.trackEvent('meal_plan_created_from_template', {
        template_id: input.templateId,
      });
    }
    return data ?? null;
  };

  const createTemplateFromPlan = async (
    input: CreateTemplateFromMealPlanInput,
  ) => {
    const result = await executeMutation(
      () => createTemplateMutation({ variables: { input } }),
      'Create template from meal plan error:',
    );
    if (!result) return null;
    const data = result.data?.createTemplateFromMealPlan;
    if (data?.success) {
      toastService.success('Meal plan saved as template!');
      Telemetry.trackEvent('template_created_from_meal_plan', {
        meal_plan_id: input.mealPlanId,
      });
    }
    return data ?? null;
  };

  const deleteTemplate = async (id: string) => {
    const result = await executeMutation(
      () => deleteTemplateMutation({ variables: { id } }),
      'Delete meal template error:',
    );
    if (!result) return false;
    const success = result.data?.deleteMealTemplate?.success ?? false;
    if (success) {
      toastService.success('Template deleted');
    }
    return success;
  };

  const duplicateTemplate = async (id: string, newName: string) => {
    const result = await executeMutation(
      () => duplicateTemplateMutation({ variables: { id, newName } }),
      'Duplicate template error:',
    );
    if (!result) return null;
    const data = result.data?.duplicateTemplate;
    if (data?.success) {
      toastService.success('Template duplicated!');
    }
    return data ?? null;
  };

  return {
    createPlanFromTemplate,
    createTemplateFromPlan,
    deleteTemplate,
    duplicateTemplate,
    loading:
      creatingFromTemplate || creatingTemplate || deleting || duplicating,
    creatingFromTemplate,
    creatingTemplate,
    deleting,
    duplicating,
  };
}
