import { useState } from 'react';
import {
  useApolloClient,
  useFragment,
  useMutation,
} from '@apollo/client/react';
import { UpdateShoppingListItemQuantityDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UseQuantityEditModal_ItemFragmentDoc } from './useQuantityEditModal.generated';
import { Telemetry } from '#/services/telemetry';
import { useTranslation } from '#/i18n';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { resolveImageUrl } from '#utils/imageUtils';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { setCachedFields } from '#/apollo/utils/cacheUpdaters';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { parseFractionalInput } from '#/utils/fractionUtils';

export interface QuantityEditItem {
  id: string;
  itemName: string;
  quantity: number;
  unitName: string | null;
  unitId: string | null;
  category: string | null;
  imageUrl?: string | null;
  version: number;
  itemUnits: Array<{
    id: string;
    symbol: string;
    name: string;
    isDefault: boolean;
    isPreferred: boolean;
  }>;
}

export interface UseQuantityEditModalOptions {
  /** Fallback lookup for the initial open, before the cache holds the entity. */
  items: ShoppingListItemDisplayFragment[];
}

export interface UseQuantityEditModalResult {
  visible: boolean;
  selectedItem: QuantityEditItem | null;
  isLoading: boolean;
  openForItem: (itemId: string) => void;
  close: () => void;
  save: (
    quantity: string,
    unitName: string | null,
    unitId: string | null,
  ) => Promise<void>;
}

/**
 * Only the entity id is held in state — the live item is read from the cache via
 * `useFragment`, so mutations reach the open sheet without re-snapshotting.
 */
export function useQuantityEditModal(
  options: UseQuantityEditModalOptions,
): UseQuantityEditModalResult {
  const { items } = options;
  const { t } = useTranslation();
  const client = useApolloClient();

  const [visible, setVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [updateQuantity] = useMutation(UpdateShoppingListItemQuantityDocument);

  // `from: null` makes `useFragment` return `complete: false`.
  const { data: liveItem, complete: liveItemComplete } = useFragment({
    fragment: UseQuantityEditModal_ItemFragmentDoc,
    fragmentName: 'useQuantityEditModal_item',
    from: selectedItemId
      ? { __typename: 'ShoppingListItem', id: selectedItemId }
      : null,
  });

  // The `items` snapshot covers the initial open, before the cache has the entity.
  const fallbackItem = selectedItemId
    ? items.find(i => i.id === selectedItemId) ?? null
    : null;
  const selectedItemRaw =
    selectedItemId && liveItemComplete ? liveItem : fallbackItem;

  const selectedItem: QuantityEditItem | null = selectedItemRaw
    ? {
        id: selectedItemRaw.id,
        itemName: firstNonBlank(selectedItemRaw.itemName) ?? t('labels.item'),
        quantity: selectedItemRaw.quantity ?? 0,
        unitName:
          firstNonBlank(
            selectedItemRaw.unit?.symbol,
            selectedItemRaw.unitName,
          ) ?? null,
        unitId: selectedItemRaw.unit?.id ?? null,
        category: firstNonBlank(selectedItemRaw.category) ?? null,
        imageUrl: resolveImageUrl(selectedItemRaw),
        version: selectedItemRaw.version,
        // Units are available on the Full fragment (detail view) but not the Display
        // fragment used in list views. Provide the current unit as the only option.
        itemUnits: selectedItemRaw.unit
          ? [
              {
                id: selectedItemRaw.unit.id,
                symbol: selectedItemRaw.unit.symbol,
                name: selectedItemRaw.unit.name,
                isDefault: true,
                isPreferred: true,
              },
            ]
          : [],
      }
    : null;

  const openForItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setSelectedItemId(item.id);
      setVisible(true);
    }
  };

  const close = () => {
    setVisible(false);
    setSelectedItemId(null);
  };

  const save = async (
    quantity: string,
    _unitName: string | null,
    unitId: string | null,
  ) => {
    if (!selectedItemRaw) return;

    setIsLoading(true);

    const itemId = selectedItemRaw.id;
    // Separators normalized, fraction preserved: the server parses this string
    // itself and rejects a comma decimal outright.
    const quantityInput = normalizeNumericTextForApi(quantity);
    // The RAW text: normalizing is not idempotent on a comma device, and a
    // second pass reads the period it just wrote as thousands grouping.
    const parsed = parseFractionalInput(quantity);
    const row = items.find(i => i.id === itemId);
    const previous = {
      quantity: row?.quantity ?? selectedItemRaw.quantity,
      quantityInput: row?.quantityInput ?? null,
    };

    // Local-first: the write can be queued, so the list shows the new quantity
    // now and after a restart, not only once the replay lands.
    const next = {
      quantityInput,
      ...(parsed !== null && { quantity: parsed }),
    };
    setCachedFields(client.cache, 'ShoppingListItem', itemId, next);
    optimisticDataPersistence.save(
      'ShoppingListItem',
      itemId,
      'quantityInput',
      quantityInput,
    );
    if (parsed !== null) {
      optimisticDataPersistence.save(
        'ShoppingListItem',
        itemId,
        'quantity',
        parsed,
      );
    }
    const clearPersisted = () => {
      optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantity');
      optimisticDataPersistence.clear(
        'ShoppingListItem',
        itemId,
        'quantityInput',
      );
    };

    const settled = await settleMutation(
      () =>
        updateQuantity({
          variables: {
            input: {
              itemId,
              quantity: quantityInput,
              unitId,
              version: selectedItemRaw.version,
            },
          },
          context: { localFirst: true },
          onCompleted: result => {
            if (appliedPayload(result)) clearPersisted();
          },
        }),
      {
        document: UpdateShoppingListItemQuantityDocument,
        fallback: t('errors.adjustQuantityFailed'),
        onFailed: () => {
          clearPersisted();
          setCachedFields(client.cache, 'ShoppingListItem', itemId, previous);
        },
      },
    );

    setIsLoading(false);

    // The sheet stays open on a failure, so what the user typed survives it.
    if (settled.status === 'failed') return;

    Telemetry.trackEvent('shopping_item_quantity_updated', {
      item_id: itemId,
      quantity,
    });

    setVisible(false);
    setSelectedItemId(null);
  };

  return { visible, selectedItem, isLoading, openForItem, close, save };
}
