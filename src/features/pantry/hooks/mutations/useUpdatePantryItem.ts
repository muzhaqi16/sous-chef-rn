/**
 * Updates the non-quantity fields the form dirtied. Local-first: they show until
 * the server answers, and a queued update replays as itself at the version it
 * holds.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItem_PantryItemFragmentDoc,
  type UseUpdatePantryItem_PantryItemFragment,
} from './useUpdatePantryItem.generated';
import type { StorageType } from '#/graphql/generated/schemaTypes';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { useTranslation } from '#/i18n';
import { buildDirtyUpdateInput } from './utils';
import type { DirtyFieldFlags, FormDataInput } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { logger } from '#/utils/environment';
import { toDateKey, todayKey } from '#/utils/dateUtils';

interface UseUpdatePantryItemOptions {
  refetch?: () => void;
}

interface UpdatePantryItemFieldsParams {
  itemId: string;
  input: FormDataInput;
  dirtyFields: DirtyFieldFlags;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  selectedStorageLocation?: {
    id: string;
    name: string;
    type: StorageType;
  } | null;
}

export function useUpdatePantryItem({ refetch }: UseUpdatePantryItemOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [updateMutation] = useMutation(UpdatePantryItemDocument, {
    context: { localFirst: true },
  });

  /**
   * Updates the dirtied non-quantity fields. Resolves once the write settles —
   * at once when it is queued — and false on a refusal, which has been alerted.
   */
  const updatePantryItemFields = async ({
    itemId,
    input,
    dirtyFields,
    selectedLocationId,
    selectedBrandId,
    selectedStorageLocation,
  }: UpdatePantryItemFieldsParams): Promise<boolean> => {
    // Build input for dirty fields only
    const updateInput = buildDirtyUpdateInput(
      input,
      dirtyFields,
      selectedLocationId,
      selectedBrandId,
    );

    // Only fire mutation if there are changes
    if (Object.keys(updateInput).length === 0) return true;

    const currentItem =
      client.cache.readFragment<UseUpdatePantryItem_PantryItemFragment>({
        id: client.cache.identify({ __typename: 'PantryItem', id: itemId }),
        fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
        fragmentName: 'useUpdatePantryItem_pantryItem',
        optimistic: true,
      });

    if (!currentItem) {
      logger.warn('Item not found, cannot update:', itemId);
      return false;
    }

    // Build optimistic update from form data (PantryItem-shaped, not mutation-input-shaped)
    const optimisticUpdate: Partial<UseUpdatePantryItem_PantryItemFragment> = {
      updatedAt: new Date().toISOString(),
    };
    if (dirtyFields.itemName) optimisticUpdate.itemName = input.itemName;
    if (dirtyFields.storageState)
      optimisticUpdate.storageState = input.storageState;
    if (dirtyFields.condition && input.condition)
      optimisticUpdate.condition = input.condition;
    if (dirtyFields.expirationDate) {
      optimisticUpdate.expiresOn = input.expirationDate
        ? toDateKey(input.expirationDate)
        : null;
    }
    if (dirtyFields.tags) optimisticUpdate.tags = input.tags ?? [];
    if (dirtyFields.minQuantity) {
      optimisticUpdate.minQuantity = input.minQuantity
        ? parseDecimalInput(input.minQuantity)
        : null;
    }
    if (dirtyFields.restockQuantity) {
      optimisticUpdate.restockQuantity = input.restockQuantity
        ? parseDecimalInput(input.restockQuantity)
        : null;
    }
    // A size in another unit re-expresses every batch, which only the server
    // can do; its answer is the first figure shown.
    const sizeUnitId = updateInput.netWeight?.netWeightUnitId;
    if (
      dirtyFields.netWeight &&
      (!sizeUnitId || sizeUnitId === currentItem.netWeightUnit?.id)
    ) {
      optimisticUpdate.netWeight = input.netWeight
        ? parseDecimalInput(input.netWeight)
        : null;
    }
    if (dirtyFields.location && selectedStorageLocation) {
      optimisticUpdate.storageLocation = {
        __typename: 'StorageLocation',
        id: selectedStorageLocation.id,
        name: selectedStorageLocation.name,
        type: selectedStorageLocation.type,
      };
    }
    if (dirtyFields.notes) optimisticUpdate.storageNotes = input.notes;
    if (dirtyFields.brand) {
      if (!selectedBrandId && !input.brand?.trim()) {
        optimisticUpdate.brand = null;
      }
    }

    // A refusal naming `field: "unit"` (a unit change while the item has
    // batches) reads as the localized `errors.field.unit` copy.
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'PantryItem', id: itemId },
      fields: optimisticUpdate,
      variables: {
        input: { ...updateInput, id: itemId, version: currentItem.version },
        today: todayKey(),
      },
      mutate: updateMutation,
      settle: {
        document: UpdatePantryItemDocument,
        fallback: t('errors.updateItemFailed'),
        onConflictRefresh: refetch,
      },
    });

    return settled.status !== 'failed';
  };

  return { updatePantryItemFields };
}
