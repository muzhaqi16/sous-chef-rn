/**
 * useCreatePantryItem - Create mutation for pantry items
 *
 * Single responsibility:
 * - Create mutation with cache update
 * - Handles both existing item linking and new item creation
 * - Storage location resolution (ID vs name)
 * - Category resolution (ID vs name)
 * - Handles PANTRY_ITEM_ALREADY_EXISTS with restock/force-add options
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';
import {
  getPantryItemDuplicateFromResult,
  promptPantryDuplicate,
} from '#/utils/errors/pantryItemDuplicate';
import {
  addToPantryItemsCache,
  adjustPantryItemCount,
} from '#/apollo/utils/pantryCacheUpdaters';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { isSuccessPayload } from '#/utils/errors/mutationPayload';
import { handleMutationError } from '#/utils/errorHandlers';
import { generateEntityId } from '#/utils/generateEntityId';
import type { CreatePantryItemParams } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { errorService } from '#/services/errorService';

interface UseCreatePantryItemOptions {
  pantryId: string | undefined;
  onSuccess?: () => void;
}

/**
 * Hook for creating pantry items
 *
 * @example
 * ```tsx
 * const { createPantryItem } = useCreatePantryItem({ pantryId, onSuccess });
 * await createPantryItem({
 *   input: formData,
 *   pantryId,
 *   quantityValue: 2,
 *   unitId: 'unit-123',
 *   selectedLocationId: null,
 *   selectedCategoryId: null,
 * });
 * ```
 */
export function useCreatePantryItem({
  pantryId,
  onSuccess,
}: UseCreatePantryItemOptions) {
  const client = useApolloClient();

  const [createMutation] = useMutation(CreatePantryItemDocument, {
    update: (cache, { data: mutationData }) => {
      const payload = mutationData?.createPantryItem;
      if (payload?.__typename !== 'CreatePantryItemPayload' || !pantryId)
        return;
      const pantryItem = payload.pantryItem;

      try {
        addToPantryItemsCache(cache, pantryId, pantryItem);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed:',
        });
      }
    },
  });

  const [restockMutation] = useMutation(RestockPantryItemDocument, {});

  const createPantryItem = async ({
    input,
    pantryId: targetPantryId,
    quantityValue,
    unitId,
    selectedLocationId,
    selectedCategoryId,
  }: CreatePantryItemParams): Promise<boolean> => {
    if (!input.itemName?.trim()) {
      alertService.alert(t('labels.error'), t('errors.itemNameRequired'));
      return false;
    }

    const storageLocationInput = selectedLocationId
      ? { storageLocationId: selectedLocationId }
      : input.location.trim()
      ? { storageLocationName: input.location.trim() }
      : {};

    // Local-first: mint the permanent cuid id (server stores it as the PK; the
    // offline queue replays via SyncPantryItem(clientId = id) → idempotent).
    const id = generateEntityId();
    const baseInput = {
      id,
      pantryId: targetPantryId,
      ...(unitId
        ? { unit: { unitId } }
        : input.unit?.trim()
        ? { unit: { unitSymbol: input.unit.trim() } }
        : {}),
      quantity: quantityValue,
      storage: {
        storageState: input.storageState,
        // Mirror the quick-add (usePantryItemSubmission) and edit
        // (buildDirtyUpdateInput) paths, which both send condition — otherwise a
        // condition picked on the full add screen is silently dropped on create.
        ...(input.condition && { condition: input.condition }),
        storageNotes: input.notes.trim() || null,
        ...storageLocationInput,
      },
      expiresAt: input.expirationDate?.toISOString() || null,
      ...(input.minQuantity || input.restockQuantity
        ? {
            thresholds: {
              ...(input.minQuantity && {
                minQuantity: parseDecimalInput(input.minQuantity),
              }),
              ...(input.restockQuantity && {
                restockQuantity: parseDecimalInput(input.restockQuantity),
              }),
            },
          }
        : {}),
      // NetWeightInput is all-or-nothing on create: the API rejects a partial
      // input (value without unit) with ValidationError(field: "netWeight").
      // Only send it when BOTH the value and the unit id are present.
      ...(input.netWeight && input.netWeightUnitId
        ? {
            netWeight: {
              netWeight: parseDecimalInput(input.netWeight),
              netWeightUnitId: input.netWeightUnitId,
            },
          }
        : {}),
    };

    let mutationInput: CreatePantryItemInput;

    if (input.selectedItemId) {
      // Linking to existing catalog item
      mutationInput = {
        ...baseInput,
        itemId: input.selectedItemId,
      };
    } else {
      // Creating new item via inline item input
      const category = selectedCategoryId
        ? selectedCategoryId
        : input.category.trim() || undefined;

      mutationInput = {
        ...baseInput,
        item: {
          name: input.itemName.trim(),
          description: input.notes.trim() || null,
          ...(input.brand?.trim() && { brand: input.brand.trim() }),
          ...(category && { category }),
        },
      };
    }

    // Write the item into the cache before firing, so it shows immediately and
    // stays if the create is queued offline (the queue replays it later, keyed by
    // this id).
    // Built before the try: the `?.`/`??`/ternary below are value blocks, and
    // the React Compiler bails out of a hook when one appears inside a try body.
    const optimisticItem = buildOptimisticPantryItem(
      id,
      {
        pantryId: targetPantryId,
        itemName: input.itemName?.trim() ?? '',
        quantity: quantityValue,
        itemId: input.selectedItemId,
        unitId,
        storageState: input.storageState,
        expiresAt: input.expirationDate?.toISOString() ?? null,
        location: input.location?.trim() || null,
        minQuantity: input.minQuantity
          ? parseDecimalInput(input.minQuantity)
          : null,
      },
      client.cache,
    );
    try {
      addToPantryItemsCache(client.cache, targetPantryId, optimisticItem);
      // Bumped HERE, beside the optimistic row, not in the mutation's `update:`
      // callback — that callback only runs with a server payload, so offline
      // the row appeared while the header kept the old count.
      adjustPantryItemCount(client.cache, targetPantryId, 1);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Pantry Item (optimistic)',
      });
    }

    const result = await createMutation({
      variables: { input: mutationInput },
      context: { localFirst: true },
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'created') {
      onSuccess?.();
      return true;
    }

    // Duplicate is a rejection with a recoverable path (restock / add-anyway).
    // The server may surface it as a typed `DuplicatePantryItemError` member of
    // the result union (in `data`) or as a GraphQL error carrying the
    // PANTRY_ITEM_ALREADY_EXISTS code (in `errors`); the shared helper checks both.
    const duplicateInfo = getPantryItemDuplicateFromResult(
      result.data?.createPantryItem,
      result.error,
    );
    if (duplicateInfo) {
      // Already in the pantry → the server keeps the existing row, not our
      // optimistic cuid. Evict the phantom optimistic item.
      safeEvict(client.cache, 'PantryItem', id);
      adjustPantryItemCount(client.cache, targetPantryId, -1);
      return new Promise<boolean>(resolve => {
        promptPantryDuplicate({
          onCancel: () => resolve(false),
          onRestock: async () => {
            const restockQuantity = quantityValue ?? 1;
            // Built before the try — the conditional spread is a value block,
            // and the React Compiler bails out of this hook when one sits
            // inside a try body.
            const restockInput = {
              id: duplicateInfo.existingPantryItemId,
              quantity: restockQuantity,
              // Carry the expiry the user entered into the restock batch
              // (the full-add form doesn't collect cost/store).
              ...(input.expirationDate && {
                expiresAt: input.expirationDate.toISOString(),
              }),
              // idempotencyKey dedups the restock ledger row on replay.
              idempotencyKey: generateEntityId(),
            };
            let restockResult;
            try {
              restockResult = await restockMutation({
                variables: { input: restockInput },
                // Local-first: queued offline, replayed as the canonical
                // mutation (deduped by its idempotencyKey).
                context: { localFirst: true },
              });
            } catch (error) {
              errorService.reportError(error, {
                operation: 'Restock pantry item error:',
              });
            }
            // `restockResult` is undefined only when the call threw; under
            // errorPolicy 'all' a transport/GraphQL error instead resolves as
            // `{ error }`. restockMutation has no `onError`, so surface both the
            // throw and the resolved-error cases here.
            if (!restockResult || restockResult.error) {
              alertService.alert(
                t('labels.error'),
                t('errors.restockFailedRetry'),
              );
              resolve(false);
              return;
            }
            // A resolved non-success union member (ValidationError / ConflictError
            // / …) carries no `error`, so classifyCreateResult catches it where a
            // bare falsy check would treat the refusal as success.
            if (classifyCreateResult(restockResult) === 'rejected') {
              alertRejectedMutation(
                restockResult,
                t('errors.restockFailedRetry'),
              );
              resolve(false);
              return;
            }
            // Success payload, or queued offline (replays later) — both succeed.
            onSuccess?.();
            resolve(true);
          },
          onAddAnyway: async () => {
            let retryResult;
            try {
              retryResult = await createMutation({
                variables: {
                  input: { ...mutationInput, forceAdd: true },
                },
              });
            } catch (error) {
              errorService.reportError(error, {
                operation: 'Force add pantry item error:',
              });
            }
            if (!retryResult) {
              alertService.alert(
                t('labels.error'),
                t('errors.addItemFailedRetry'),
              );
              resolve(false);
              return;
            }
            if (
              isSuccessPayload(
                retryResult.data?.createPantryItem,
                'CreatePantryItemPayload',
              )
            ) {
              onSuccess?.();
              resolve(true);
            } else {
              alertService.alert(
                t('labels.error'),
                t('errors.addItemFailedRetry'),
              );
              resolve(false);
            }
          },
        });
      });
    }

    if (outcome === 'rejected') {
      // The server refused the create — discard the item we showed. Surface a
      // real (non-network) error; a non-success payload has none.
      safeEvict(client.cache, 'PantryItem', id);
      adjustPantryItemCount(client.cache, targetPantryId, -1);
      if (result.error) {
        handleMutationError(result.error, { operation: 'Create Pantry Item' });
      }
      return false;
    }

    // Queued offline / API unreachable — the item stays in the cache and the
    // queue replays the create once connectivity returns; count it as success.
    onSuccess?.();
    return true;
  };

  return { createPantryItem };
}
