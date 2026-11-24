import type { TranslateFn } from '#/i18n';
import { BatchStatus, ItemCondition } from '#/graphql/generated/schemaTypes';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { daysUntilExpiry } from '#domain/expiry';
import { catalogTestIDs } from '#features/catalog/testIDs';
import type { PantryItemSheet } from '#features/pantry/components/PantryItemDetailSheets';
import type { UsePantryItemDetailActionsResult } from '#features/pantry/hooks/usePantryItemDetailActions';
import type { PantryPermissions } from '#features/pantry/utils/pantryPermissions';
import { pantryTestIDs } from '#features/pantry/testIDs';
import type {
  PantryItemDetailData,
  PantryItemDetailItem,
} from './usePantryItemDetailData';

interface PantryItemHeaderActionsOptions {
  item: PantryItemDetailItem;
  batches: PantryItemDetailData['batches'];
  today: string;
  permissions: PantryPermissions;
  actions: UsePantryItemDetailActionsResult;
  onEdit: () => void;
  openSheet: (sheet: PantryItemSheet) => void;
  t: TranslateFn;
}

/** The pantry item bar's actions, each offered only where the user may act. */
export function pantryItemHeaderActions({
  item,
  batches,
  today,
  permissions,
  actions,
  onEdit,
  openSheet,
  t,
}: PantryItemHeaderActionsOptions): HeaderAction[] {
  // The EXPIRED flag can land a day late east of UTC, so the date decides too:
  // the batches' dates, since the server discards only expired batches.
  const hasExpiredBatches =
    (item.quantity > 0 &&
      (item.condition === ItemCondition.Expired ||
        (!!item.earliestBatchExpiresOn &&
          daysUntilExpiry(item.earliestBatchExpiresOn, today) < 0))) ||
    batches.some(
      batch =>
        batch.status === BatchStatus.Active &&
        !!batch.expiresOn &&
        daysUntilExpiry(batch.expiresOn, today) < 0,
    );
  const added = actions.addToListStatus === 'success';

  return [
    ...(permissions.canAddItems
      ? [
          {
            icon: added ? 'cart' : 'cart-outline',
            accessibilityLabel: t('labels.addToShoppingList'),
            onPress: () => {
              void actions.handleAddToShoppingList();
            },
            variant: added ? 'success' : 'primary',
            loading: actions.addToListStatus === 'loading',
            testID: pantryTestIDs.itemAddToListButton,
          } satisfies HeaderAction,
        ]
      : []),
    ...(permissions.canEditItems
      ? ([
          {
            icon: 'swap-vertical-outline',
            accessibilityLabel: t('adjustQuantity.title'),
            onPress: () => actions.setAdjustModalVisible(true),
            testID: pantryTestIDs.itemAdjustButton,
          },
          {
            icon: 'create-outline',
            accessibilityLabel: t('labels.edit'),
            onPress: onEdit,
            testID: pantryTestIDs.itemEditButton,
          },
          {
            icon: 'camera-outline',
            accessibilityLabel: t('a11y.changePhoto'),
            onPress: () => openSheet({ type: 'photo' }),
            testID: catalogTestIDs.entryPhotoChangeButton,
          },
          {
            icon: 'swap-horizontal-outline',
            accessibilityLabel: t('relinkItem.action'),
            onPress: () => openSheet({ type: 'relink' }),
            testID: pantryTestIDs.itemRelinkButton,
          },
        ] satisfies HeaderAction[])
      : []),
    ...(hasExpiredBatches && permissions.canRemoveItems
      ? ([
          {
            icon: 'close-circle-outline',
            accessibilityLabel: t('labels.discard'),
            onPress: actions.handleDiscardExpired,
            variant: 'error',
            testID: pantryTestIDs.itemDiscardButton,
          },
        ] satisfies HeaderAction[])
      : []),
    ...(permissions.canRemoveItems
      ? ([
          {
            icon: 'trash-outline',
            accessibilityLabel: t('labels.delete'),
            onPress: actions.handleDelete,
            variant: 'error',
            testID: pantryTestIDs.itemDeleteButton,
          },
        ] satisfies HeaderAction[])
      : []),
  ];
}
