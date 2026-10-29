import { useState } from 'react';
import {
  useApolloClient,
  useFragment,
  useMutation,
} from '@apollo/client/react';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UseQuantityEditModal_ItemFragmentDoc } from './useQuantityEditModal.generated';
import { Telemetry } from '#/services/telemetry';
import { useTranslation } from '#/i18n';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { resolveImageUrl } from '#utils/imageUtils';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { shownLineReading } from '#features/shoppingList/utils/lineReading';
import { unitLabel, type UnitLabelSource } from '#/utils/formatQuantity';

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
    unit: UnitLabelSource;
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

  const [updateQuantity] = useMutation(UpdateShoppingListItemDocument, {
    context: { localFirst: true },
  });

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

  // The sheet opens on the amount as the row reads it (0.91 kg for a 2 lb line
  // to a metric reader), and saves what is typed in that unit.
  const readingSystem = useReadingSystem();
  const shown =
    selectedItemId && liveItemComplete
      ? shownLineReading(liveItem, readingSystem)
      : null;
  const storedUnit = selectedItemRaw?.unit ?? null;
  // A reading names its own unit, carried whole like the stored one.
  const shownUnit = shown
    ? { id: shown.unitId, unit: shown }
    : storedUnit && { id: storedUnit.id, unit: storedUnit };

  const selectedItem: QuantityEditItem | null = selectedItemRaw
    ? {
        id: selectedItemRaw.id,
        itemName: firstNonBlank(selectedItemRaw.itemName) ?? t('labels.item'),
        quantity: shown?.value ?? selectedItemRaw.quantity ?? 0,
        unitName:
          // As the sheet's chip reads it, so an untouched sheet saves nothing.
          firstNonBlank(unitLabel(shownUnit?.unit), selectedItemRaw.unitName) ??
          null,
        unitId: shownUnit?.id ?? null,
        category: firstNonBlank(selectedItemRaw.category) ?? null,
        imageUrl: resolveImageUrl(selectedItemRaw),
        version: selectedItemRaw.version,
        // Units are available on the Full fragment (detail view) but not the Display
        // fragment used in list views. Provide the shown unit as the only option.
        itemUnits: shownUnit
          ? [{ ...shownUnit, isDefault: true, isPreferred: true }]
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
    // now and after a restart, not only once the replay lands. A figure in
    // another unit waits for the server's line: written here it would read in
    // the old unit, and the cache may hold too little of the new one to show.
    const sameUnit = unitId === null || unitId === selectedItemRaw.unit?.id;
    const next = sameUnit
      ? { quantityInput, ...(parsed !== null && { quantity: parsed }) }
      : {};
    const entity = { __typename: 'ShoppingListItem', id: itemId };
    if (sameUnit) writeEntityFields(client.cache, entity, next);
    const clearPersisted = optimisticDataPersistence.trackFields(
      'ShoppingListItem',
      itemId,
      next,
    );

    const settled = await settleMutation(
      () =>
        updateQuantity({
          variables: {
            input: {
              id: itemId,
              quantity: quantityInput,
              // An omitted unit is left as it is; null would clear it.
              ...(unitId !== null && { unit: { id: unitId } }),
              version: selectedItemRaw.version,
            },
          },
          onCompleted: result => {
            if (appliedPayload(result)) clearPersisted();
          },
        }),
      {
        document: UpdateShoppingListItemDocument,
        fallback: t('errors.adjustQuantityFailed'),
        onFailed: () => {
          clearPersisted();
          writeEntityFields(client.cache, entity, previous);
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
