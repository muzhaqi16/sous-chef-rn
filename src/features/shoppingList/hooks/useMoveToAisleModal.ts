import { useState } from 'react';
import {
  useApolloClient,
  useFragment,
  useMutation,
} from '@apollo/client/react';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { knownDepartment } from '#features/shoppingList/utils/aisles';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useTranslation } from '#/i18n';
import { UseMoveToAisleModal_ItemFragmentDoc } from './useMoveToAisleModal.generated';

/** The line the aisle picker is open for. */
export interface AisleLine {
  department: StoreDepartment;
  /** Moved by a shopper, so it can go back under its item's aisle. */
  moved: boolean;
}

/**
 * Moves a line to another aisle through the line's own update. Local-first:
 * the line changes heading at once and keeps it through a restart while queued.
 */
export function useMoveToAisleModal() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [lineId, setLineId] = useState<string | null>(null);

  const [updateLine] = useMutation(UpdateShoppingListItemDocument, {
    context: { localFirst: true },
  });

  const { data, complete } = useFragment({
    fragment: UseMoveToAisleModal_ItemFragmentDoc,
    fragmentName: 'useMoveToAisleModal_item',
    from: lineId ? { __typename: 'ShoppingListItem', id: lineId } : null,
  });
  const current = lineId && complete ? data : null;

  const close = () => setLineId(null);

  /** To `department`, or back under its item's aisle with null. */
  const moveTo = async (department: StoreDepartment | null) => {
    if (!current) return;
    setLineId(null);

    const entity = { __typename: 'ShoppingListItem', id: current.id };
    const previous = {
      storeDepartment: current.storeDepartment,
      storeDepartmentOverride: current.storeDepartmentOverride,
    };
    const next = {
      storeDepartment:
        department ?? current.item?.storeDepartment ?? StoreDepartment.Other,
      storeDepartmentOverride: department,
    };
    writeEntityFields(client.cache, entity, next);
    const clearPersisted = optimisticDataPersistence.trackFields(
      'ShoppingListItem',
      current.id,
      next,
    );

    await settleMutation(
      () =>
        updateLine({
          variables: {
            input: {
              id: current.id,
              version: current.version,
              storePrefs: { storeDepartmentOverride: department },
            },
          },
          onCompleted: result => {
            if (appliedPayload(result)) clearPersisted();
          },
        }),
      {
        document: UpdateShoppingListItemDocument,
        fallback: t('shoppingListScreens.serverNotUpdated', {
          action: t('shoppingListScreens.updated'),
        }),
        onFailed: () => {
          clearPersisted();
          writeEntityFields(client.cache, entity, previous);
        },
      },
    );
  };

  const line: AisleLine | null = current
    ? {
        department: knownDepartment(current.storeDepartment),
        moved: current.storeDepartmentOverride !== null,
      }
    : null;

  return {
    visible: lineId !== null,
    line,
    openForItem: setLineId,
    close,
    moveTo,
  };
}
