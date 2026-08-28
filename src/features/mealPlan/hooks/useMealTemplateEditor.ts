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
import { useTranslation } from '#/i18n';
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
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { updateEntityFieldsLocalFirst } from '#/apollo/utils/localFirstFields';
import {
  buildOptimisticTemplateItem,
  addTemplateItemToCache,
  removeTemplateItemFromCache,
  readTemplateItem,
  readRecipeRef,
} from '#features/mealPlan/utils/optimisticTemplateItem';
import { useUser } from '#store/useAppStore';
import {
  TemplateCategory,
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
const removeFromMealTemplates = createRemoveFromQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

/**
 * Materialize a complete `MealTemplateDisplay` entity for a local-first create,
 * mirroring useMealPlanActions' optimistic plan builder. Fallbacks match the
 * server's defaults; `home` degrades to null when only a homeId is known — the
 * post-replay response heals the gap.
 */
function buildOptimisticMealTemplate(
  id: string,
  input: Omit<CreateMealTemplateInput, 'id'>,
  creatorId: string,
): MealTemplateDisplayFragment {
  const now = new Date().toISOString();
  return {
    __typename: 'MealTemplate',
    id,
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? TemplateCategory.Custom,
    durationDays: input.durationDays ?? 7,
    defaultServings: input.defaultServings ?? 2,
    tags: input.tags ?? [],
    usageCount: 0,
    lastUsedAt: null,
    homeId: input.homeId ?? null,
    home: null,
    user: { __typename: 'User', id: creatorId },
    createdAt: now,
    updatedAt: now,
  };
}

export function useMealTemplateEditor() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const user = useUser();

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

  // Items are local-first too now. `AddTemplateItemInput.id` accepts a
  // client-minted CUID2, so a replayed add resolves to the same row
  // (`IDEMPOTENT_REPLAY`) instead of adding the line twice; update writes
  // absolute fields on an existing id; and a replayed remove converges
  // server-side rather than 404ing. Each writes the cache before firing,
  // because these mutations return the whole `mealTemplate { items }` and rely
  // on the response to move anything on screen.

  // Returns the created template's id (for navigation) or null on failure.
  const createTemplate = async (
    input: Omit<CreateMealTemplateInput, 'id'>,
  ): Promise<string | null> => {
    const id = generateEntityId();

    // Local-first: write the template into the cache before firing so an
    // offline/queued create is visible in the overview immediately (the queued
    // replay converges on the same client-minted id). Without this, "queued"
    // reports success while the list shows nothing until a later refetch.
    const optimisticTemplate = user
      ? buildOptimisticMealTemplate(id, input, user.id)
      : null;
    if (optimisticTemplate) {
      try {
        client.cache.writeFragment({
          id: client.cache.identify(optimisticTemplate),
          fragment: MealTemplateDisplayFragmentDoc,
          fragmentName: 'MealTemplateDisplay',
          data: optimisticTemplate,
        });
        addToMealTemplates(client.cache, optimisticTemplate, {
          position: 'start',
          skipStoreField: skipUnmatchedFilterVariants({
            category: optimisticTemplate.category,
          }),
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Create Meal Template (optimistic)',
        });
      }
    }

    let result;
    try {
      result = await createMutation({
        variables: { input: { ...input, id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create Meal Template error:',
      });
    }

    const rejected =
      !result ||
      alertIfRejected(result, t('mealTemplateBuilder.failedToCreate'));
    if (rejected) {
      if (optimisticTemplate) {
        try {
          removeFromMealTemplates(client.cache, id, { evictItem: true });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected Meal Template create',
          });
        }
      }
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
      // Built before the try — conditional spreads inside a try body make the
      // React Compiler bail out of this hook.
      const optimisticTemplate = {
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
      };
      try {
        client.cache.writeFragment({
          id: cacheId,
          fragment: UseMealTemplateEditor_TemplateFragmentDoc,
          fragmentName: 'useMealTemplateEditor_template',
          data: optimisticTemplate,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Update Meal Template (optimistic)',
        });
      }
    }

    let result;
    try {
      result = await updateMutation({
        variables: { input: { ...input, id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Meal Template error:',
      });
    }

    const revert = () => {
      if (snapshot) {
        try {
          client.cache.writeFragment({
            id: cacheId,
            fragment: UseMealTemplateEditor_TemplateFragmentDoc,
            fragmentName: 'useMealTemplateEditor_template',
            data: snapshot,
          });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert Meal Template update',
          });
        }
      }
    };

    if (!result) {
      revert();
      return false;
    }
    if (alertIfRejected(result, t('mealTemplateBuilder.failedToSave'))) {
      revert();
      return false;
    }
    return true;
  };

  const addItem = async (input: AddTemplateItemInput): Promise<boolean> => {
    const id = generateEntityId();
    const optimisticItem = buildOptimisticTemplateItem(client.cache, id, input);

    try {
      addTemplateItemToCache(client.cache, input.templateId, optimisticItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Template Item (optimistic)',
      });
    }

    let result;
    try {
      result = await addItemMutation({
        variables: { input: { ...input, id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Add Template Item error:',
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      try {
        removeTemplateItemFromCache(client.cache, input.templateId, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected template-item add',
        });
      }
      alertIfRejected(result, t('mealTemplateBuilder.failedToAddItem'));
      return false;
    }
    return true;
  };

  const updateItem = async (
    input: UpdateTemplateItemInput,
  ): Promise<boolean> => {
    const { id, meal, ...flatFields } = input;
    const previousItem = readTemplateItem(client.cache, id);
    // `meal` is an @oneOf ref, not a flat field — the row shows it as
    // `customMealName` / `recipe`, so map it rather than writing it through.
    //
    // BOTH fields move together. The input can only name one of them, but the
    // entity carries both, so writing only the named one leaves the row holding
    // the value it was supposed to replace: renaming a recipe-backed row to a
    // custom name kept the old recipe, and picking a recipe left the row with
    // neither a name nor a recipe. Offline no response arrives to reconcile it.
    const updates = {
      ...flatFields,
      ...(meal
        ? {
            customMealName: meal.customMealName ?? null,
            recipe: readRecipeRef(client.cache, meal.recipeId),
          }
        : {}),
    };

    const { persisted, result } = await updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: previousItem ? { __typename: 'MealTemplateItem', id } : undefined,
      updates,
      previous: Object.fromEntries(
        Object.keys(updates).map(key => [
          key,
          (previousItem as Record<string, unknown> | null)?.[key],
        ]),
      ),
      logLabel: 'Update Template Item',
      mutate: () =>
        updateItemMutation({
          variables: { input },
          context: { localFirst: true },
        }),
    });

    if (!persisted) {
      alertIfRejected(result, t('mealTemplateBuilder.failedToSaveItem'));
      return false;
    }
    return true;
  };

  /**
   * @param templateId - the parent, needed to take the row out of its `items`
   *   list before the server answers (and to put it back on a refusal).
   */
  const removeItem = async (
    itemId: string,
    templateId: string,
  ): Promise<boolean> => {
    // Snapshot before evicting: a refusal has to put the row back, and once the
    // entity is gone the cache can no longer describe it.
    const removed = readTemplateItem(client.cache, itemId);
    const parentTemplateId = templateId;

    if (parentTemplateId) {
      try {
        removeTemplateItemFromCache(client.cache, parentTemplateId, itemId);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Remove Template Item (optimistic)',
        });
      }
    }

    let result;
    try {
      result = await removeItemMutation({
        variables: { input: { id: itemId } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Remove Template Item error:',
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      if (removed && parentTemplateId) {
        try {
          addTemplateItemToCache(client.cache, parentTemplateId, removed);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected template-item remove',
          });
        }
      }
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
    /** Template ITEM edits are online-only — disable the controls, don't fail the tap. */
  };
}
