/**
 * useMealTemplateEditor — author and edit meal templates.
 *
 * - createTemplate: mints the permanent cuid PK and fires createMealTemplate
 *   (with its inline items) local-first — a queued replay converges on the same
 *   row by id. The created template is added to the overview connection from the
 *   response; returns its id for navigation.
 * - updateTemplate: local-first optimistic write of the edited metadata
 *   (name/category/tags/…), reverting the snapshot on a refused result.
 * - add/update/remove item: online authoring mutations. The server returns the
 *   updated template (or item), which Apollo normalizes — no optimistic write,
 *   since a new item's id is server-minted (nothing to key an offline replay on).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import {
  CreateMealTemplateDocument,
  UpdateMealTemplateDocument,
  AddTemplateItemDocument,
  UpdateTemplateItemDocument,
  RemoveTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  UseMealTemplateEditor_TemplateFragmentDoc,
  type UseMealTemplateEditor_TemplateFragment,
} from './useMealTemplateEditor.generated';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import type {
  CreateMealTemplateInput,
  UpdateMealTemplateInput,
  AddTemplateItemInput,
  UpdateTemplateItemInput,
} from '#/graphql/generated/schemaTypes';

const addToMealTemplates = createAddToQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

export function useMealTemplateEditor() {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [createMutation, { loading: creating }] = useMutation(
    CreateMealTemplateDocument,
    {
      update: (cache, { data }) => {
        if (
          data?.createMealTemplate?.__typename === 'CreateMealTemplatePayload'
        ) {
          addToMealTemplates(cache, data.createMealTemplate.mealTemplate, {
            position: 'start',
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
    const id = generateEntityId();
    const result = await executeMutation(
      () =>
        createMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      'Create Meal Template error:',
    );

    if (!result) return null;
    const outcome = classifyCreateResult(
      result,
      'createMealTemplate',
      'CreateMealTemplatePayload',
    );
    if (outcome === 'rejected') {
      alertIfRejected(
        result,
        'createMealTemplate',
        'CreateMealTemplatePayload',
        t('mealTemplateBuilder.failedToCreate'),
      );
      return null;
    }
    // created (server) or queued (offline, replays keyed by the same id).
    return id;
  };

  const updateTemplate = async (
    id: string,
    input: Omit<UpdateMealTemplateInput, 'id'>,
  ): Promise<boolean> => {
    const cacheId = client.cache.identify({ __typename: 'MealTemplate', id });
    const snapshot = cacheId
      ? client.cache.readFragment<UseMealTemplateEditor_TemplateFragment>({
          id: cacheId,
          fragment: UseMealTemplateEditor_TemplateFragmentDoc,
          fragmentName: 'useMealTemplateEditor_template',
        })
      : null;

    if (snapshot) {
      executeCacheUpdate(
        () =>
          client.cache.writeFragment({
            id: cacheId,
            fragment: UseMealTemplateEditor_TemplateFragmentDoc,
            fragmentName: 'useMealTemplateEditor_template',
            data: {
              ...snapshot,
              ...(input.name != null && { name: input.name }),
              ...(input.description !== undefined && {
                description: input.description,
              }),
              ...(input.category !== undefined && { category: input.category }),
              ...(input.defaultServings !== undefined && {
                defaultServings: input.defaultServings,
              }),
              ...(input.tags !== undefined && { tags: input.tags }),
              updatedAt: new Date().toISOString(),
            },
          }),
        'Update Meal Template (optimistic)',
      );
    }

    const result = await executeMutation(
      () =>
        updateMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      'Update Meal Template error:',
    );

    const revert = () => {
      if (snapshot) {
        executeCacheUpdate(
          () =>
            client.cache.writeFragment({
              id: cacheId,
              fragment: UseMealTemplateEditor_TemplateFragmentDoc,
              fragmentName: 'useMealTemplateEditor_template',
              data: snapshot,
            }),
          'Revert Meal Template update',
        );
      }
    };

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(
        result,
        'updateMealTemplate',
        'UpdateMealTemplatePayload',
        t('mealTemplateBuilder.failedToSave'),
      )
    ) {
      revert();
      return false;
    }
    return true;
  };

  const addItem = async (input: AddTemplateItemInput): Promise<boolean> => {
    const result = await executeMutation(
      () => addItemMutation({ variables: { input } }),
      'Add Template Item error:',
    );
    if (!result) return false;
    return !alertIfRejected(
      result,
      'addTemplateItem',
      'AddTemplateItemPayload',
      t('mealTemplateBuilder.failedToAddItem'),
    );
  };

  const updateItem = async (
    input: UpdateTemplateItemInput,
  ): Promise<boolean> => {
    const result = await executeMutation(
      () => updateItemMutation({ variables: { input } }),
      'Update Template Item error:',
    );
    if (!result) return false;
    return !alertIfRejected(
      result,
      'updateTemplateItem',
      'UpdateTemplateItemPayload',
      t('mealTemplateBuilder.failedToSaveItem'),
    );
  };

  const removeItem = async (itemId: string): Promise<boolean> => {
    const result = await executeMutation(
      () => removeItemMutation({ variables: { input: { id: itemId } } }),
      'Remove Template Item error:',
    );
    if (!result) return false;
    return !alertIfRejected(
      result,
      'removeTemplateItem',
      'RemoveTemplateItemPayload',
      t('mealTemplateBuilder.failedToRemoveItem'),
    );
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
  };
}
