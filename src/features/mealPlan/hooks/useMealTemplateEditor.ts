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
import {
  sendLocalWrite,
  useLocalWrite,
} from '#/apollo/pendingWrites/useLocalWrite';
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
  const addTemplateItem = useLocalWrite(AddTemplateItemDocument, {
    fallback: t('mealTemplateBuilder.failedToAddItem'),
  });
  const updateTemplateItem = useLocalWrite(UpdateTemplateItemDocument, {
    fallback: t('mealTemplateBuilder.failedToSaveItem'),
  });
  const removeTemplateItem = useLocalWrite(RemoveTemplateItemDocument, {
    fallback: t('mealTemplateBuilder.failedToRemoveItem'),
    removal: true,
  });

  // Returns the created template's id (for navigation) or null on failure.
  const createTemplate = (input: Omit<CreateMealTemplateInput, 'id'>) =>
    create(input);

  const updateTemplate = async (
    id: string,
    input: Omit<UpdateMealTemplateInput, 'id'>,
  ): Promise<boolean> => {
    const settled = await sendLocalWrite(
      client.cache,
      UpdateMealTemplateDocument,
      { input: { ...input, id } },
      updateMutation,
      { fallback: t('mealTemplateBuilder.failedToSave') },
      {
        entity: { __typename: 'MealTemplate', id },
        fields: {
          name: input.name ?? undefined,
          description: input.description,
          category: input.category,
          defaultServings: input.defaultServings,
          tags: input.tags,
          updatedAt: new Date().toISOString(),
        },
      },
    );
    return settled.status !== 'failed';
  };

  // `AddTemplateItemInput.id` takes a minted id, so a replayed add answers the
  // same row and a replayed remove converges.
  const addItem = async (input: AddTemplateItemInput): Promise<boolean> => {
    const item = { ...input, id: generateEntityId() };
    const inputs: AddTemplateItemInputs = { item };
    const settled = await addTemplateItem.send({ input: item }, inputs);
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

    const settled = await updateTemplateItem.sendFields({
      entity: { __typename: 'MealTemplateItem', id },
      fields,
      variables: { input },
    });
    return settled.status !== 'failed';
  };

  /** `templateId` is the parent, whose `items` list shows the row. */
  const removeItem = async (
    itemId: string,
    templateId: string,
  ): Promise<boolean> => {
    const inputs: RemoveTemplateItemInputs = { templateId };
    const settled = await removeTemplateItem.send(
      { input: { id: itemId } },
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
