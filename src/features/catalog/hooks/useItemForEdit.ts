import { errorService } from '#services/errorService';
import { useQuery, useFragment } from '@apollo/client/react';
import {
  GetItemForEditDocument,
  UseItemForEdit_ItemFragmentDoc,
  type UseItemForEdit_ItemFragment,
} from '#features/catalog/hooks/useItemForEdit.generated';
import type { EditableItemSnapshot } from '#domain/items/suggestItemChanges';

export interface UseItemForEditResult {
  /** null until the cache holds every field the diff needs. */
  snapshot: EditableItemSnapshot | null;
  loading: boolean;
  error: unknown;
  /** Re-runs the query. `error` alone strands the caller on a spinner. */
  refetch: () => void;
}

const nullableToUndefined = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

function itemToEditableSnapshot(
  item: UseItemForEdit_ItemFragment,
): EditableItemSnapshot {
  const primaryBrand = item.brands[0]?.brand;
  return {
    id: item.id,
    version: item.version,
    canEdit: item.canEdit,
    canSuggest: item.canSuggest,
    name: item.name,
    description: nullableToUndefined(item.description),
    type: item.type,
    brandId: primaryBrand?.id,
    brandName: primaryBrand?.name,
    storageState: item.storageState,
    tags: item.tags,
    primaryUpc: nullableToUndefined(item.primaryUpc),
    shelfLifeDays: nullableToUndefined(item.shelfLifeDays),
    shelfLifeOpenedDays: nullableToUndefined(item.shelfLifeOpenedDays),
    netWeight: nullableToUndefined(item.netWeight),
    netWeightKind: nullableToUndefined(item.netWeightKind),
    displayUnitId: item.displayUnit?.id,
    displayUnitName: item.displayUnit?.name,
    baseDimension: nullableToUndefined(item.baseDimension),
    imageUrl: nullableToUndefined(item.imageUrl),
  };
}

/**
 * Loads the canonical pre-edit snapshot of a catalog item. Withheld entirely
 * until the read is complete: a partial read reports absent fields as
 * user-cleared values, and lies about `canEdit`.
 */
export function useItemForEdit(itemId: string): UseItemForEditResult {
  const { loading, error, refetch } = useQuery(GetItemForEditDocument, {
    variables: { id: itemId },
  });

  // Read through the fragment rather than `data.item`: under dataMasking the
  // query's `item` is just { __typename, id }, and reading the cache entity by
  // key means UpdateItem's write-through refreshes this without a refetch.
  const result = useFragment({
    fragment: UseItemForEdit_ItemFragmentDoc,
    fragmentName: 'useItemForEdit_item',
    from: { __typename: 'Item', id: itemId },
  });

  return {
    snapshot: result.complete ? itemToEditableSnapshot(result.data) : null,
    loading,
    error,
    refetch: () => {
      void refetch().catch(error =>
        errorService.reportError(error, { operation: 'ItemForEdit.refetch' }),
      );
    },
  };
}
