/**
 * useMealTemplateEditor — author and edit meal templates.
 *
 * Every mutation here is ONLINE-ONLY: template authoring happens at home with
 * connectivity, so the hook refuses up front when the API is unreachable rather
 * than queueing a replay. Screens read `isApiUnavailable` to disable the
 * affordance instead of letting the tap fail.
 *
 * - createTemplate: mints the permanent cuid PK and fires createMealTemplate
 *   (with its inline items). The created template is added to the overview
 *   connection from the response; returns its id for navigation.
 * - updateTemplate: writes the edited metadata (name/category/tags/…).
 * - add/update/remove item: the server returns the updated template (or item),
 *   which Apollo normalizes.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  CreateMealTemplateDocument,
  UpdateMealTemplateDocument,
  AddTemplateItemDocument,
  UpdateTemplateItemDocument,
  RemoveTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  createAddToQueryConnectionUpdater,
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import {
  type CreateMealTemplateInput,
  type UpdateMealTemplateInput,
  type AddTemplateItemInput,
  type UpdateTemplateItemInput,
} from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

const addToMealTemplates = createAddToQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

export function useMealTemplateEditor() {
  const { t } = useTranslation();
  const isApiUnavailable = useIsApiUnavailable();

  const [createMutation, { loading: creating }] = useMutation(
    CreateMealTemplateDocument,
    {
      update: (cache, { data }) => {
        if (
          data?.createMealTemplate?.__typename === 'CreateMealTemplatePayload'
        ) {
          addToMealTemplates(cache, data.createMealTemplate.mealTemplate, {
            position: 'start',
            // Scope the write to variants this template belongs to: the
            // browser sheet caches one `mealTemplates` entry per category/search
            // the user has visited, and cache.modify fans out across all of them.
            skipStoreField: skipUnmatchedFilterVariants({
              category: data.createMealTemplate.mealTemplate.category,
            }),
          });
        }
      },
    },
  );
  const [updateMutation, { loading: updating }] = useMutation(
    UpdateMealTemplateDocument,
  );
  const [addItemMutation, { loading: addingItem }] = useMutation(
    AddTemplateItemDocument,
  );
  const [updateItemMutation] = useMutation(UpdateTemplateItemDocument);
  const [removeItemMutation] = useMutation(RemoveTemplateItemDocument);

  // Returns the created template's id (for navigation) or null on failure.
  const createTemplate = async (
    input: Omit<CreateMealTemplateInput, 'id'>,
  ): Promise<string | null> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }
    // Client-minted PK: a retried create resolves to the same row rather than
    // adding a second template.
    const id = generateEntityId();

    let result;
    try {
      result = await createMutation({ variables: { input: { ...input, id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create Meal Template error:',
      });
    }

    const rejected =
      !result ||
      alertIfRejected(result, t('mealTemplateBuilder.failedToCreate'));
    if (rejected) return null;
    return id;
  };

  const updateTemplate = async (
    id: string,
    input: Omit<UpdateMealTemplateInput, 'id'>,
  ): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await updateMutation({ variables: { input: { ...input, id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Meal Template error:',
      });
    }

    if (!result) return false;
    if (alertIfRejected(result, t('mealTemplateBuilder.failedToSave'))) {
      return false;
    }
    return true;
  };

  const addItem = async (input: AddTemplateItemInput): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }
    const id = generateEntityId();

    let result;
    try {
      result = await addItemMutation({
        variables: { input: { ...input, id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Add Template Item error:',
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      alertIfRejected(result, t('mealTemplateBuilder.failedToAddItem'));
      return false;
    }
    return true;
  };

  const updateItem = async (
    input: UpdateTemplateItemInput,
  ): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await updateItemMutation({ variables: { input } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Template Item error:',
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      alertIfRejected(result, t('mealTemplateBuilder.failedToSaveItem'));
      return false;
    }
    return true;
  };

  const removeItem = async (
    itemId: string,
    // The response carries the whole `mealTemplate { items }`, so the parent id
    // is not read here; it stays in the signature for call sites that pass it.
    _templateId?: string,
  ): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await removeItemMutation({
        variables: { input: { id: itemId } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Remove Template Item error:',
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      alertIfRejected(result, t('mealTemplateBuilder.failedToRemoveItem'));
      return false;
    }
    return true;
  };

  return {
    createTemplate,
    updateTemplate,
    addItem,
    updateItem,
    removeItem,
    creating,
    updating,
    addingItem,
    isApiUnavailable,
  };
}
