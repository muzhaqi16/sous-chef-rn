/**
 * Authors and edits meal templates, local-first: create and every item mutation
 * mint an id the server accepts, so a queued replay converges on the same row.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  UpdateMealTemplateDocument,
  AddTemplateItemDocument,
  UpdateTemplateItemDocument,
  RemoveTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { readRecipeRef } from '#features/mealPlan/cache/mealTemplateItem';
import { useCreateMealTemplate } from '#features/mealPlan/hooks/useCreateMealTemplate';
import type {
  AddTemplateItemInputs,
  RemoveTemplateItemInputs,
} from '#features/mealPlan/offline/localWrites';
import type {
  CreateMealTemplateInput,
  UpdateMealTemplateInput,
  AddTemplateItemInput,
  UpdateTemplateItemInput,
} from '#/graphql/generated/schemaTypes';

export function useMealTemplateEditor() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { createTemplate: create, creating } = useCreateMealTemplate();

  const [updateMutation, { loading: updating }] = useMutation(
    UpdateMealTemplateDocument,
    { context: { localFirst: true } },
  );
  const [addItemMutation] = useMutation(AddTemplateItemDocument, {
    context: { localFirst: true },
  });
  const [updateItemMutation] = useMutation(UpdateTemplateItemDocument, {
    context: { localFirst: true },
  });
  const [removeItemMutation] = useMutation(RemoveTemplateItemDocument, {
    context: { localFirst: true },
  });

  // Returns the created template's id (for navigation) or null on failure.
  const createTemplate = (input: Omit<CreateMealTemplateInput, 'id'>) =>
    create(input);

  const updateTemplate = async (
    id: string,
    input: Omit<UpdateMealTemplateInput, 'id'>,
  ): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'MealTemplate', id },
      fields: {
        name: input.name ?? undefined,
        description: input.description,
        category: input.category,
        defaultServings: input.defaultServings,
        tags: input.tags,
        updatedAt: new Date().toISOString(),
      },
      variables: { input: { ...input, id } },
      mutate: updateMutation,
      settle: {
        document: UpdateMealTemplateDocument,
        fallback: t('mealTemplateBuilder.failedToSave'),
      },
    });
    return settled.status !== 'failed';
  };

  // `AddTemplateItemInput.id` takes a minted id, so a replayed add answers the
  // same row and a replayed remove converges.
  const addItem = async (input: AddTemplateItemInput): Promise<boolean> => {
    const item = { ...input, id: generateEntityId() };
    const inputs: AddTemplateItemInputs = { item };
    const settled = await pendingWritesOf(client.cache).send(
      AddTemplateItemDocument,
      { input: item },
      write =>
        settleMutation(() => addItemMutation(write), {
          document: AddTemplateItemDocument,
          fallback: t('mealTemplateBuilder.failedToAddItem'),
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  const updateItem = async (
    input: UpdateTemplateItemInput,
  ): Promise<boolean> => {
    const { id, meal, ...flatFields } = input;
    // `meal` is an @oneOf ref naming one of `customMealName` / `recipe`, but
    // the entity carries both, so BOTH are written: the other would keep the
    // value it replaces, and offline no response reconciles it.
    const fields = {
      ...flatFields,
      ...(meal
        ? {
            customMealName: meal.customMealName ?? null,
            recipe: readRecipeRef(client.cache, meal.recipeId),
          }
        : {}),
    };

    const settled = await sendFields(client.cache, {
      entity: { __typename: 'MealTemplateItem', id },
      fields,
      variables: { input },
      mutate: updateItemMutation,
      settle: {
        document: UpdateTemplateItemDocument,
        fallback: t('mealTemplateBuilder.failedToSaveItem'),
      },
    });
    return settled.status !== 'failed';
  };

  /** `templateId` is the parent, whose `items` list shows the row. */
  const removeItem = async (
    itemId: string,
    templateId: string,
  ): Promise<boolean> => {
    const inputs: RemoveTemplateItemInputs = { templateId };
    const settled = await pendingWritesOf(client.cache).send(
      RemoveTemplateItemDocument,
      { input: { id: itemId } },
      write =>
        settleMutation(() => removeItemMutation(write), {
          document: RemoveTemplateItemDocument,
          fallback: t('mealTemplateBuilder.failedToRemoveItem'),
          removal: true,
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  /** Empty when the cache has not seen the recipe; the save response fills it. */
  const readRecipeName = (recipeId: string): string =>
    readRecipeRef(client.cache, recipeId)?.name ?? '';

  return {
    createTemplate,
    updateTemplate,
    addItem,
    updateItem,
    removeItem,
    readRecipeName,
    creating,
    updating,
  };
}
