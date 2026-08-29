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
import { handleMutationError } from '#/utils/errorHandlers';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';

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
  const isApiUnavailable = useIsApiUnavailable();

  const [createFromTemplateMutation, { loading: creatingFromTemplate }] =
    useMutation(CreateMealPlanFromTemplateDocument, {
      update: (cache, { data }) => {
        const result = data?.createMealPlanFromTemplate;
        if (result?.__typename === 'CreateMealPlanPayload') {
          addToMealPlans(cache, result.mealPlan, { position: 'start' });
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Create Plan from Template' });
      },
    });

  const [createTemplateMutation, { loading: creatingTemplate }] = useMutation(
    CreateTemplateFromMealPlanDocument,
    {
      update: (cache, { data }) => {
        const payload = data?.createTemplateFromMealPlan;
        if (payload?.__typename === 'CreateTemplateFromMealPlanPayload') {
          addToMealTemplates(cache, payload.mealTemplate, {
            position: 'start',
            // Scope the write to variants this template belongs to: the
            // browser sheet caches one `mealTemplates` entry per category/search
            // the user has visited, and cache.modify fans out across all of them.
            skipStoreField: skipUnmatchedFilterVariants({
              category: payload.mealTemplate.category,
            }),
          });
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Save as Template' });
      },
    },
  );

  const [deleteTemplateMutation, { loading: deleting }] = useMutation(
    DeleteMealTemplateDocument,
    {
      // Runs on the server's response, not ahead of it: the row leaves the
      // browser sheet's connections once the delete is confirmed.
      update: (cache, { data }) => {
        const payload = data?.deleteMealTemplate;
        if (payload?.__typename === 'DeleteMealTemplatePayload') {
          removeFromMealTemplates(cache, payload.mealTemplate.id, {
            evictItem: true,
          });
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Delete Template' });
      },
    },
  );

  const [duplicateTemplateMutation, { loading: duplicating }] = useMutation(
    DuplicateTemplateDocument,
    {
      update: (cache, { data }) => {
        const payload = data?.duplicateTemplate;
        if (payload?.__typename === 'DuplicateTemplatePayload') {
          addToMealTemplates(cache, payload.mealTemplate, {
            position: 'start',
            skipStoreField: skipUnmatchedFilterVariants({
              category: payload.mealTemplate.category,
            }),
          });
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Duplicate Template' });
      },
    },
  );

  const createPlanFromTemplate = async (
    input: CreateMealPlanFromTemplateInput,
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }
    let result;
    try {
      result = await createFromTemplateMutation({ variables: { input } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create meal plan from template error:',
      });
    }
    if (!result) return null;
    const data = result.data?.createMealPlanFromTemplate;
    if (data?.__typename === 'CreateMealPlanPayload') {
      toastService.success(t('mealTemplateActions.planCreated'));
      Telemetry.trackEvent('meal_plan_created_from_template', {
        template_id: input.templateId,
      });
    }
    return data ?? null;
  };

  const createTemplateFromPlan = async (
    input: CreateTemplateFromMealPlanInput,
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }
    let result;
    try {
      result = await createTemplateMutation({ variables: { input } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create template from meal plan error:',
      });
    }
    if (!result) return null;
    const data = result.data?.createTemplateFromMealPlan;
    if (data?.__typename === 'CreateTemplateFromMealPlanPayload') {
      toastService.success(t('mealTemplateActions.savedAsTemplate'));
      Telemetry.trackEvent('template_created_from_meal_plan', {
        meal_plan_id: input.mealPlanId,
      });
    }
    return data ?? null;
  };

  const deleteTemplate = async (id: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }
    let result;
    try {
      result = await deleteTemplateMutation({ variables: { input: { id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Delete meal template error:',
      });
    }

    if (classifyCreateResult(result) === 'rejected') return false;

    toastService.success(t('mealTemplateActions.templateDeleted'));
    return true;
  };

  const duplicateTemplate = async (id: string, newName: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }
    let result;
    try {
      result = await duplicateTemplateMutation({
        variables: { input: { id, newName } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Duplicate template error:',
      });
    }
    if (!result) return null;
    const data = result.data?.duplicateTemplate;
    if (data?.__typename === 'DuplicateTemplatePayload') {
      toastService.success(t('mealTemplateActions.templateDuplicated'));
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
    isApiUnavailable,
  };
}
