/**
 * useMealPlanActions - Meal plan create / update / delete (online-only).
 *
 * Every write fires against the API and reconciles the cache from the SERVER's
 * response: create and delete maintain the `mealPlans` overview connection in
 * their `update` callbacks, and update needs none — the mutation returns the
 * whole `MealPlanDisplay`, which Apollo normalizes by `__typename + id`.
 *
 * Offline the hook refuses up front and toasts localized copy; callers read the
 * returned `isApiUnavailable` to disable the affordance instead of letting the
 * user reach a refusal.
 */

import { useMutation } from '@apollo/client/react';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { handleMutationError } from '#/utils/errorHandlers';
import { generateEntityId } from '#/utils/generateEntityId';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';

const addToMealPlans = createAddToQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);
const removeFromMealPlans = createRemoveFromQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);

export function useMealPlanActions() {
  const isApiUnavailable = useIsApiUnavailable();

  const [createMealPlanMutation, { loading: creating }] = useMutation(
    CreateMealPlanDocument,
    {
      update: (cache, { data }) => {
        const result = data?.createMealPlan;
        if (result?.__typename === 'CreateMealPlanPayload') {
          addToMealPlans(cache, result.mealPlan, { position: 'start' });
        }
      },
    },
  );

  const [updateMealPlanMutation, { loading: updating }] = useMutation(
    UpdateMealPlanDocument,
  );

  const [deleteMealPlanMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanDocument,
    {
      update: (cache, { data }) => {
        const result = data?.deleteMealPlan;
        if (result?.__typename === 'DeleteMealPlanPayload') {
          removeFromMealPlans(cache, result.mealPlan.id, { evictItem: true });
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Delete Meal Plan' });
      },
    },
  );

  const createMealPlan = async (input: CreateMealPlanInput) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }

    // Client-minted PK: a retry whose first response was lost resolves as
    // ConflictError(IDEMPOTENT_REPLAY) instead of creating a second plan.
    const id = generateEntityId();

    let result;
    try {
      result = await createMealPlanMutation({
        variables: { input: { ...input, id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create Meal Plan error:',
      });
    }

    if (!result) return null;
    return result.data?.createMealPlan ?? null;
  };

  const updateMealPlan = async (
    id: string,
    input: Omit<UpdateMealPlanInput, 'id'>,
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }

    let result;
    try {
      result = await updateMealPlanMutation({
        variables: { input: { ...input, id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Meal Plan error:',
      });
    }

    if (!result) return null;
    return result.data?.updateMealPlan ?? null;
  };

  const deleteMealPlan = async (id: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await deleteMealPlanMutation({
        variables: { input: { id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Delete Meal Plan error:',
      });
    }

    // A refusal (or a throw) leaves the card in place: the `update` callback
    // above removes it only on the server's success payload.
    return classifyCreateResult(result) !== 'rejected';
  };

  return {
    createMealPlan,
    updateMealPlan,
    deleteMealPlan,
    loading: creating || updating || deleting,
    creating,
    updating,
    deleting,
    isApiUnavailable,
  };
}
