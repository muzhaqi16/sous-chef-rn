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
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
import { addToPantryItemsCache } from './utils';
import { buildOptimisticPantryItem } from '#hooks/home/pantry/buildOptimisticPantryItem';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import {
  executeCacheUpdate,
  executeMutation,
  isSuccessPayload,
} from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';
import { generateEntityId } from '#/utils/generateEntityId';
import type { CreatePantryItemParams } from './types';

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

      executeCacheUpdate(
        () => addToPantryItemsCache(cache, pantryId, pantryItem),
        'Cache update failed:',
      );
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
      alertService.alert('Error', 'Please enter an item name');
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
        storageNotes: input.notes.trim() || null,
        ...storageLocationInput,
      },
      expiresAt: input.expirationDate?.toISOString() || null,
      ...(input.minQuantity || input.restockQuantity
        ? {
            thresholds: {
              ...(input.minQuantity && {
                minQuantity: parseFloat(input.minQuantity),
              }),
              ...(input.restockQuantity && {
                restockQuantity: parseFloat(input.restockQuantity),
              }),
            },
          }
        : {}),
      ...(input.netWeight
        ? {
            netWeight: {
              netWeight: parseFloat(input.netWeight),
              ...(input.netWeightUnitId && {
                netWeightUnitId: input.netWeightUnitId,
              }),
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
    executeCacheUpdate(
      () =>
        addToPantryItemsCache(
          client.cache,
          targetPantryId,
          buildOptimisticPantryItem(id, {
            pantryId: targetPantryId,
            itemName: input.itemName?.trim() ?? '',
            quantity: quantityValue,
            itemId: input.selectedItemId,
            unitId,
            unitName: input.unit?.trim() || null,
            storageState: input.storageState,
            expiresAt: input.expirationDate?.toISOString() ?? null,
            location: input.location?.trim() || null,
            minQuantity: input.minQuantity
              ? parseFloat(input.minQuantity)
              : null,
          }),
        ),
      'Add Pantry Item (optimistic)',
    );

    const result = await createMutation({
      variables: { input: mutationInput },
      context: { localFirst: true },
    });

    if (
      isSuccessPayload(result.data?.createPantryItem, 'CreatePantryItemPayload')
    ) {
      onSuccess?.();
      return true;
    }

    // Check for duplicate pantry item error
    if (result.error && isPantryItemDuplicateError(result.error)) {
      const duplicateInfo = getPantryItemDuplicateInfo(result.error);
      if (duplicateInfo) {
        // Already in the pantry → the server keeps the existing row, not our
        // optimistic cuid. Evict the phantom optimistic item.
        safeEvict(client.cache, 'PantryItem', id);
        return new Promise<boolean>(resolve => {
          alertService.alert(
            'Item Already in Pantry',
            'This item is already in your pantry. Would you like to restock it or add a separate entry?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Restock',
                onPress: async () => {
                  const restockQuantity = quantityValue ?? 1;
                  const restockResult = await executeMutation(
                    () =>
                      restockMutation({
                        variables: {
                          input: {
                            id: duplicateInfo.existingPantryItemId,
                            quantity: restockQuantity,
                          },
                        },
                      }),
                    'Restock pantry item error:',
                  );
                  if (!restockResult) {
                    alertService.alert(
                      'Error',
                      'Failed to restock item. Please try again.',
                    );
                    resolve(false);
                    return;
                  }
                  onSuccess?.();
                  resolve(true);
                },
              },
              {
                text: 'Add Anyway',
                onPress: async () => {
                  const retryResult = await executeMutation(
                    () =>
                      createMutation({
                        variables: {
                          input: { ...mutationInput, forceAdd: true },
                        },
                      }),
                    'Force add pantry item error:',
                  );
                  if (!retryResult) {
                    alertService.alert(
                      'Error',
                      'Failed to add item. Please try again.',
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
                      'Error',
                      'Failed to add item. Please try again.',
                    );
                    resolve(false);
                  }
                },
              },
            ],
          );
        });
      }
    }

    if (result.error) {
      // A real (non-network) error came back — the create was rejected. Discard
      // the item we showed immediately and surface the error.
      safeEvict(client.cache, 'PantryItem', id);
      handleMutationError(result.error, { operation: 'Create Pantry Item' });
      return false;
    }

    if (result.data) {
      // The server returned a non-success payload (e.g. ValidationError) without
      // a GraphQL error — also a rejection. Discard the item we showed.
      safeEvict(client.cache, 'PantryItem', id);
      return false;
    }

    // No data and no error means the request was queued while offline or the API
    // was unreachable. The item we wrote stays in the cache and the queue replays
    // the create once connectivity returns, so this counts as success.
    onSuccess?.();
    return true;
  };

  return { createPantryItem };
}
