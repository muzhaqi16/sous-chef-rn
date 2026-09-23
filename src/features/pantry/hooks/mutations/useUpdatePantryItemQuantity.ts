/**
 * Local-first: the updated quantity is written to the cache PERMANENTLY
 * before firing (an `optimisticResponse` would roll back on the offline queue's
 * null result), so a queued update stays visible and replays via the idempotent
 * `SyncPantryItem` upsert; a real rejection restores the pre-edit snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
  type UseUpdatePantryItemQuantity_PantryItemFragment,
} from './useUpdatePantryItemQuantity.generated';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { logger } from '#/utils/environment';
import { useTranslation } from '#/i18n';

interface UseUpdatePantryItemQuantityOptions {
  refetch?: () => void;
}

interface UpdateQuantityParams {
  itemId: string;
  quantityInput: string;
  quantityValue: number;
}

export function useUpdatePantryItemQuantity({
  refetch,
}: UseUpdatePantryItemQuantityOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [updateQuantityMutation] = useMutation(
    UpdatePantryItemQuantityDocument,
  );

  /**
   * Sets the quantity in the stack's own unit; the unit changes through
   * `changePantryItemUnit`. Resolves once the write settles — at once when it
   * is queued — and false on a refusal, which has been alerted.
   */
  const updateQuantity = async ({
    itemId,
    quantityInput,
    quantityValue,
  }: UpdateQuantityParams): Promise<boolean> => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    const currentItem =
      client.cache.readFragment<UseUpdatePantryItemQuantity_PantryItemFragment>(
        {
          id: cacheId,
          fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        },
      );

    if (!currentItem) {
      logger.warn('Item not found, cannot update quantity:', itemId);
      return false;
    }

    // The field accepts fractions ("1 1/4") as well as decimals, so it needs
    // the fraction-aware parser — `parseDecimalInput` declines a fraction
    // outright rather than misreading it.
    const quantityText = quantityInput || quantityValue.toString();
    const newQuantity = parseFractionalInput(quantityText);
    if (newQuantity === null) {
      logger.warn('Unreadable quantity, nothing written:', itemId);
      return false;
    }

    // The set amount is what the stack holds; the response recounts packages.
    const optimisticPantryItem = enhanceWithVersion(currentItem, {
      quantity: newQuantity,
      heldQuantity: newQuantity,
    });

    // Permanent write BEFORE firing: survives an offline/API-down queue
    // (where no response ever arrives to materialize the change).
    const writeItem = (data: UseUpdatePantryItemQuantity_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
        fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        data,
      });
    try {
      writeItem(optimisticPantryItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Update Pantry Item Quantity (optimistic)',
      });
    }

    const revert = () => {
      try {
        writeItem(currentItem);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Pantry Item quantity update',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        updateQuantityMutation({
          variables: {
            input: {
              pantryItemId: itemId,
              // Separators normalized, fraction preserved: the server parses
              // this string itself and rejects a comma decimal outright.
              quantity: normalizeNumericTextForApi(quantityText),
              version: currentItem.version,
            },
          },
          // Queue offline / on API-down — replays via the idempotent SyncPantryItem.
          context: { localFirst: true },
        }),
      {
        document: UpdatePantryItemQuantityDocument,
        fallback: t('errors.updateItemFailed'),
        onFailed: revert,
        onConflictRefresh: refetch,
      },
    );

    return settled.status !== 'failed';
  };

  return { updateQuantity };
}
