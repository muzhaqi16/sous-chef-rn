/**
 * Local-first: the updated quantity shows until the server answers, and a queued
 * update replays as itself at the version it holds.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
  type UseUpdatePantryItemQuantity_PantryItemFragment,
} from './useUpdatePantryItemQuantity.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { logger } from '#/utils/environment';
import { useTranslation } from '#/i18n';
import type { writeHeldStock } from '#features/pantry/cache/stock';
import type { SetStockInputs } from '#features/pantry/offline/localWrites';
import { todayKey } from '#/utils/dateUtils';
import { statedAmount } from '#/utils/formatQuantity';

interface UseUpdatePantryItemQuantityOptions {
  refetch?: () => void;
}

/** A unit as the stack's shown amount holds it, whole from the cache. */
export type StatedUnit = NonNullable<
  Parameters<typeof writeHeldStock>[3]
>['unit'] & { conversionFactor: number; displayAsFraction: boolean };

interface UpdateQuantityParams {
  itemId: string;
  quantityInput: string;
  quantityValue: number;
  /** The count multiple the amount is stated in (a dozen); else the stack's own unit. */
  statedIn?: StatedUnit | null;
}

export function useUpdatePantryItemQuantity({
  refetch,
}: UseUpdatePantryItemQuantityOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [updateQuantityMutation] = useMutation(
    UpdatePantryItemQuantityDocument,
    { context: { localFirst: true } },
  );

  /**
   * Sets the quantity in the stack's own unit, or in the dozen it is shown in;
   * the unit changes through `changePantryItemUnit`. Resolves once the write settles — at once when it
   * is queued — and false on a refusal, which has been alerted.
   */
  const updateQuantity = async ({
    itemId,
    quantityInput,
    quantityValue,
    statedIn,
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
          optimistic: true,
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
    // A dozen counts in pieces, the unit its factor is stated against.
    const held = statedIn
      ? newQuantity * statedIn.conversionFactor
      : newQuantity;
    const inputs: SetStockInputs = {
      held,
      now: new Date().toISOString(),
      // Shown as typed ("2 doz").
      ...(statedIn && {
        shown: {
          __typename: 'DisplayAmount',
          quantity: newQuantity,
          ...statedAmount(newQuantity, statedIn, statedIn.displayAsFraction),
          unit: statedIn,
        },
      }),
    };
    const settled = await pendingWritesOf(client.cache).send(
      UpdatePantryItemQuantityDocument,
      {
        today: todayKey(),
        input: {
          pantryItemId: itemId,
          // Separators normalized, fraction preserved: the server parses
          // this string itself and rejects a comma decimal outright.
          quantity: normalizeNumericTextForApi(quantityText),
          ...(statedIn && { unitId: statedIn.id }),
          version: currentItem.version,
        },
      },
      write =>
        settleMutation(() => updateQuantityMutation(write), {
          document: UpdatePantryItemQuantityDocument,
          fallback: t('errors.updateItemFailed'),
          onConflictRefresh: refetch,
        }),
      inputs,
    );

    return settled.status !== 'failed';
  };

  return { updateQuantity };
}
