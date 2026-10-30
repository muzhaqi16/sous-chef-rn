/**
 * Authors and edits meal templates, local-first: create and every item mutation
 * mint an id the server accepts, so a queued replay converges on the same row.
 * Metadata updates snapshot first and revert on a refusal.
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
import { settleMutation } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import {
  addTemplateItemToCache,
  localTemplateItem,
  removeTemplateItemFromCache,
  readTemplateItem,
  readRecipeRef,
  type LocalTemplateItem,
} from '#features/mealPlan/cache/mealTemplateItem';
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
 * A complete `MealTemplateDisplay` for a local-first create. Fallbacks match
 * the server's defaults; `home` is null when only a homeId is known, until the
 * replay's response fills it.
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
    defaultServings: input.defaultServings ?? 4,
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
      context: { localFirst: true },
      update: (cache, { data }) => {
        const payload = appliedPayload(data);
        if (payload) {
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
    },
  );
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

  // `AddTemplateItemInput.id` takes a minted id, so a replayed add resolves to
  // the same row (`IDEMPOTENT_REPLAY`) and a replayed remove converges. Each
  // writes the cache before firing: offline, no response moves the screen.

  // Returns the created template's id (for navigation) or null on failure.
  const createTemplate = async (
    input: Omit<CreateMealTemplateInput, 'id'>,
  ): Promise<string | null> => {
    const id = generateEntityId();

    // Written before firing so a queued create shows in the overview at once;
    // without it "queued" reports success over an empty list.
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

    const revertCreate = () => {
      if (!optimisticTemplate) return;
      try {
        removeFromMealTemplates(client.cache, id, { evictItem: true });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Meal Template create',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        createMutation({
          variables: { input: { ...input, id } },
        }),
      {
        document: CreateMealTemplateDocument,
        fallback: t('mealTemplateBuilder.failedToCreate'),
        onFailed: revertCreate,
      },
    );
    // Applied (server) or queued (offline, replays keyed by the same id).
    return settled.status === 'failed' ? null : id;
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

    const settled = await settleMutation(
      () =>
        updateMutation({
          variables: { input: { ...input, id } },
        }),
      {
        document: UpdateMealTemplateDocument,
        fallback: t('mealTemplateBuilder.failedToSave'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  const addItem = async (input: AddTemplateItemInput): Promise<boolean> => {
    const id = generateEntityId();
    const localItem = localTemplateItem(client.cache, id, input);

    try {
      addTemplateItemToCache(client.cache, input.templateId, localItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Template Item (optimistic)',
      });
    }

    const revertAdd = () => {
      try {
        removeTemplateItemFromCache(client.cache, input.templateId, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected template-item add',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        addItemMutation({
          variables: { input: { ...input, id } },
        }),
      {
        document: AddTemplateItemDocument,
        fallback: t('mealTemplateBuilder.failedToAddItem'),
        onFailed: revertAdd,
      },
    );
    return settled.status !== 'failed';
  };

  const updateItem = async (
    input: UpdateTemplateItemInput,
  ): Promise<boolean> => {
    const { id, meal, ...flatFields } = input;
    const previousItem = readTemplateItem(client.cache, id);
    // `meal` is an @oneOf ref naming one of `customMealName` / `recipe`, but
    // the entity carries both, so BOTH are written: the other would keep the
    // value it replaces, and offline no response reconciles it.
    const updates = {
      ...flatFields,
      ...(meal
        ? {
            customMealName: meal.customMealName ?? null,
            recipe: readRecipeRef(client.cache, meal.recipeId),
          }
        : {}),
    };

    return updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: previousItem ? { __typename: 'MealTemplateItem', id } : undefined,
      updates,
      // A key the read did not carry is omitted, not recorded as null, so the
      // revert leaves that field alone rather than blanking a value the
      // snapshot never saw.
      previous: snapshotFields(previousItem, updates),
      settle: () =>
        settleMutation(() => updateItemMutation({ variables: { input } }), {
          document: UpdateTemplateItemDocument,
          fallback: t('mealTemplateBuilder.failedToSaveItem'),
        }),
    });
  };

  /**
   * @param templateId - the parent, needed to take the row out of its `items`
   *   list before the server answers (and to put it back on a refusal).
   */
  const removeItem = async (
    itemId: string,
    templateId: string,
  ): Promise<boolean> => {
    // Snapshot before evicting: a refusal has to put the row back, and an
    // evicted entity is one the cache cannot describe. The read is partial (the
    // editor's query selects no `recipe`); the restore completes it.
    const snapshot = readTemplateItem(client.cache, itemId);
    const removed: LocalTemplateItem | null = snapshot
      ? { ...snapshot, __typename: 'MealTemplateItem', id: itemId }
      : null;
    const parentTemplateId = templateId;

    // No snapshot means no revert. Evicting anyway is how a refused remove left
    // the row gone under a message saying it had failed — refuse the remove
    // instead, so the row the user can still see is the row that still exists.
    if (!removed) {
      alertService.alert(
        t('labels.error'),
        t('mealTemplateBuilder.failedToRemoveItem'),
      );
      return false;
    }

    if (parentTemplateId) {
      try {
        removeTemplateItemFromCache(client.cache, parentTemplateId, itemId);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Remove Template Item (optimistic)',
        });
      }
    }

    const restoreItem = () => {
      if (!parentTemplateId) return;
      try {
        addTemplateItemToCache(client.cache, parentTemplateId, removed);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected template-item remove',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        removeItemMutation({
          variables: { input: { id: itemId } },
        }),
      {
        document: RemoveTemplateItemDocument,
        fallback: t('mealTemplateBuilder.failedToRemoveItem'),
        removal: true,
        onFailed: restoreItem,
      },
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
