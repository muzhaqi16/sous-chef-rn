import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreateMealPlanFromTemplateDocument,
  CreateTemplateFromMealPlanDocument,
  DeleteMealTemplateDocument,
  DuplicateTemplateDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  type CreateMealPlanFromTemplateInput,
  type CreateTemplateFromMealPlanInput,
} from '#/graphql/generated/schemaTypes';
import { handleMutationError } from '#/utils/errorHandlers';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import {
  executeMutation,
  executeCacheUpdate,
} from '#/utils/compilerSafeWrappers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { t } from '#/i18n/t';

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
  const client = useApolloClient();
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
          });
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Save as Template' });
      },
    },
  );

  // The optimistic remove + revert live in deleteTemplate (local-first), so this
  // mutation has no update callback — only the transport-error reporter.
  const [deleteTemplateMutation, { loading: deleting }] = useMutation(
    DeleteMealTemplateDocument,
    {
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
    const result = await executeMutation(
      () => createFromTemplateMutation({ variables: { input } }),
      'Create meal plan from template error:',
    );
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
    const result = await executeMutation(
      () => createTemplateMutation({ variables: { input } }),
      'Create template from meal plan error:',
    );
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
    // Snapshot first so a server rejection can restore the template card.
    const cacheId = client.cache.identify({ __typename: 'MealTemplate', id });
    const snapshot = cacheId
      ? client.cache.readFragment<MealTemplateDisplayFragment>({
          id: cacheId,
          fragment: MealTemplateDisplayFragmentDoc,
          fragmentName: 'MealTemplateDisplay',
        })
      : null;

    // Local-first: remove from the cache BEFORE firing, so the deletion shows
    // immediately and survives an offline queue. Replaying the delete for an
    // already-deleted template is idempotent on the API — it resolves to a
    // success payload, so the queue drains the entry without a spurious
    // sync-failed toast. Mirrors deleteMealPlan.
    executeCacheUpdate(
      () => removeFromMealTemplates(client.cache, id, { evictItem: true }),
      'Delete Template (optimistic)',
    );

    const result = await executeMutation(
      () =>
        deleteTemplateMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      'Delete meal template error:',
    );

    const outcome = !result
      ? 'rejected'
      : classifyCreateResult(
          result,
          'deleteMealTemplate',
          'DeleteMealTemplatePayload',
        );

    if (outcome === 'rejected') {
      if (snapshot && cacheId) {
        executeCacheUpdate(() => {
          client.cache.writeFragment({
            id: cacheId,
            fragment: MealTemplateDisplayFragmentDoc,
            fragmentName: 'MealTemplateDisplay',
            data: snapshot,
          });
          addToMealTemplates(client.cache, snapshot, { position: 'start' });
        }, 'Restore refused Template delete');
      }
      return false;
    }

    // 'created' (online) or 'queued' (offline) — both keep the optimistic remove.
    toastService.success(t('mealTemplateActions.templateDeleted'));
    return true;
  };

  const duplicateTemplate = async (id: string, newName: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }
    const result = await executeMutation(
      () =>
        duplicateTemplateMutation({ variables: { input: { id, newName } } }),
      'Duplicate template error:',
    );
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
