import React from 'react';
import { EntryImageSource } from '#graphql/generated/schemaTypes';
import { EntryPhotoSheet } from '#features/catalog/ui/EntryPhotoSheet';
import { ItemPhotoViewer } from '#features/catalog/ui/ItemPhotoViewer/ItemPhotoViewer';
import { useEntryPhoto } from '#features/catalog/hooks/useEntryPhoto';
import { RelinkItemSheet } from '#features/pantry/components/RelinkItemSheet';
import { AdjustQuantityModal } from '#features/pantry/components/modals/AdjustQuantityModal';
import { ConsumePantryItemModal } from '#features/pantry/components/modals/ConsumePantryItemModal';
import type { UsedBatch } from '#features/pantry/types';
import { BatchWasteSheet } from '#features/pantry/components/BatchWasteSheet';
import type { WastedBatch } from '#features/pantry/hooks/mutations/useWastePantryItemBatch';
import { CorrectPackageSizeModal } from '#features/pantry/components/modals/CorrectPackageSizeModal';
import type { UsePantryItemDetailActionsResult } from '#features/pantry/hooks/usePantryItemDetailActions';
import type { PantryItemDetailItem } from '#features/pantry/screens/usePantryItemDetailData';
import type { ActiveSheet } from '#hooks/ui/useActiveSheet';
import { useOpening } from '#hooks/ui/useOpening';
import { useSelectedHomeId } from '#store/useAppStore';

// The sheets the screen opens itself. Adjusting, using a batch and correcting
// a package size are opened by the writes that own them, in the actions hook.
export type PantryItemSheet =
  | { type: 'viewer'; index: number }
  | { type: 'photo' }
  | { type: 'relink' };

interface PantryItemDetailSheetsProps {
  itemId: string;
  item: PantryItemDetailItem;
  /** The gallery, in the order the hero shows it. */
  photos: NonNullable<PantryItemDetailItem['item']['photos']>[number][];
  actions: UsePantryItemDetailActionsResult;
  /** The item's batches as the screen reads them: a use from one is bounded by it. */
  batches: readonly (UsedBatch & WastedBatch)[];
  sheets: ActiveSheet<PantryItemSheet>;
  canEdit: boolean;
  onConflictRefresh: () => void;
}

/** Every sheet the pantry item screen opens. */
export const PantryItemDetailSheets: React.FC<PantryItemDetailSheetsProps> = ({
  itemId,
  item,
  photos,
  actions,
  batches,
  sheets,
  canEdit,
  onConflictRefresh,
}) => {
  const selectedHomeId = useSelectedHomeId();
  const entryPhoto = useEntryPhoto(selectedHomeId, item.itemId);
  const { active, open, close } = sheets;
  // The viewer offers "Use this photo" on every photo but the one in use.
  const pickableIndex = photos.findIndex(
    photo => photo.id !== item.image?.catalogImageId,
  );

  // Mounted and driven by `visible`, each keeps the batch it opened on while
  // it animates out, so a close never makes it vanish mid-presentation.
  const batchUse = useOpening(!!actions.usingBatchId, actions.usingBatchId);
  const usedBatch = batches.find(batch => batch.id === batchUse?.payload);
  const correcting = useOpening(
    !!actions.correctingBatchId,
    actions.correctingBatchId,
  );

  return (
    <>
      <AdjustQuantityModal
        visible={actions.adjustModalVisible}
        pantryItemId={itemId}
        onClose={() => actions.setAdjustModalVisible(false)}
        onConfirm={actions.handleConfirmAdjust}
      />
      <ConsumePantryItemModal
        compact
        visible={!!actions.usingBatchId}
        pantryItemId={itemId}
        batch={usedBatch ?? null}
        onClose={() => actions.setUsingBatchId(null)}
        onConfirm={actions.handleConfirmBatchUse}
      />
      <BatchWasteSheet
        pantryItemId={itemId}
        batches={batches}
        wastingBatchId={actions.wastingBatchId}
        onClose={() => actions.setWastingBatchId(null)}
        onConfirm={actions.handleConfirmBatchWaste}
      />
      {correcting?.payload ? (
        <CorrectPackageSizeModal
          visible={!!actions.correctingBatchId}
          pantryItemId={itemId}
          batchId={correcting.payload}
          onClose={() => actions.setCorrectingBatchId(null)}
          onConfirm={actions.handleCorrectPackageSize}
        />
      ) : null}
      {photos.length > 0 && (
        <ItemPhotoViewer
          visible={active?.type === 'viewer'}
          photos={photos}
          initialIndex={active?.type === 'viewer' ? active.index : 0}
          onClose={() => close('viewer')}
          item={item.item}
          entryPhoto={
            canEdit
              ? {
                  currentPhotoId: item.image?.catalogImageId ?? null,
                  onUse: photoId => {
                    void entryPhoto.pickItemPhoto(photoId).then(landed => {
                      if (landed) close('viewer');
                    });
                  },
                }
              : null
          }
        />
      )}
      {!!canEdit && (
        <RelinkItemSheet
          visible={active?.type === 'relink'}
          onDismiss={() => close('relink')}
          stack={{
            id: item.id,
            version: item.version,
            itemId: item.itemId,
            itemName: item.itemName,
          }}
          onConflictRefresh={onConflictRefresh}
        />
      )}
      {!!canEdit && (
        <EntryPhotoSheet
          visible={active?.type === 'photo'}
          onDismiss={() => close('photo')}
          entryPhoto={entryPhoto}
          hasHouseholdPhoto={item.image?.source === EntryImageSource.Household}
          onPickItemPhoto={
            pickableIndex >= 0
              ? () => open({ type: 'viewer', index: pickableIndex })
              : undefined
          }
        />
      )}
    </>
  );
};
