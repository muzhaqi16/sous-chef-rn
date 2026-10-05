import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import {
  CreateItemSuggestionDocument,
  UpdateItemDocument,
} from '#features/catalog/hooks/useSuggestItemEdit.generated';
import { useImageUpload } from '#hooks/useImageUpload';
import { alertService } from '#/services/alertService';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  buildSuggestibleItemChanges,
  type EditableItemSnapshot,
} from '#utils/items/suggestItemChanges';
import { writesItemDirectly } from '#domain/itemWriteAccess';
import type { AddItemSubmitPayload } from '#features/catalog/ui/AddItemForm/AddItemForm';
import { errorService } from '#/services/errorService';
import { isVersionConflictCode } from '#/utils/errors/versionConflict';
import { presentFailure } from '#/utils/errors/presentFailure';

export type ItemEditResult =
  | { status: 'suggested' }
  | { status: 'duplicate' }
  | { status: 'updated' }
  | { status: 'imagesOnly' }
  | { status: 'noChanges' }
  | { status: 'readOnly' }
  /** The item changed since the form opened; the caller offers a refresh. */
  | { status: 'conflict'; failure: SettledFailure }
  | { status: 'failed' };

const FAILED: ItemEditResult = { status: 'failed' };

export function useSuggestItemEdit() {
  const { t } = useTranslation();
  // `uploading` has to be part of the returned `loading`: the photos-only path
  // runs no mutation at all, so without it the submit button stays live for the
  // whole upload and a second tap re-uploads the same files as new image rows.
  const { uploadItemImages, uploading } = useImageUpload();

  const [suggestEdit, { loading: suggesting }] = useMutation(
    CreateItemSuggestionDocument,
  );
  const [updateItem, { loading: updating }] = useMutation(UpdateItemDocument);

  // The 5-pending cap is the only CONFLICT either mutation raises.
  const failureCopy = {
    fallback: t('suggestItemEdit.failedBody'),
    title: t('labels.couldnTSendThat'),
    copy: {
      [ErrorCode.Conflict]: {
        title: t('suggestItemEdit.pendingCapTitle'),
        body: t('suggestItemEdit.pendingCapBody'),
      },
      [ErrorCode.NotFound]: {
        title: t('errors.itemNotFound'),
        body: t('labels.thisItemIsnTInTheCatalogAnyMoreItMayHaveBeenRemoved'),
      },
    },
  };

  const submitEdit = async (
    original: EditableItemSnapshot,
    formData: AddItemSubmitPayload,
  ): Promise<ItemEditResult> => {
    const note =
      typeof formData.editReason === 'string' ? formData.editReason.trim() : '';
    const images = Array.isArray(formData.selectedImages)
      ? formData.selectedImages
      : [];
    const { changes, hasChanges } = buildSuggestibleItemChanges(
      original,
      formData,
    );

    // Block a no-op before it reaches the wire: the server answers `{}` with a
    // ValidationError *and* spends one of only 10 suggestions per hour.
    if (!hasChanges) {
      if (images.length === 0) {
        alertService.alert(
          t('suggestItemEdit.noChangesTitle'),
          t('suggestItemEdit.noChangesBody'),
        );
        return { status: 'noChanges' };
      }
      const uploaded = await uploadImages(
        uploadItemImages,
        images,
        original.id,
      );
      // Photos are the entire submission on this path, so zero uploaded is a
      // failed submission — telling the user it was received would close the
      // form over a batch that never left the device.
      if (uploaded === 0) return FAILED;
      alertService.alert(
        t('suggestItemEdit.photosOnlyTitle'),
        t('suggestItemEdit.photosOnlyBody'),
      );
      return { status: 'imagesOnly' };
    }

    // The two write paths are mutually exclusive and each hard-fails when
    // picked wrongly, so route on the server's own predicates rather than
    // inferring from visibility. An admin on a public item has both, and
    // suggests like anyone else.
    if (writesItemDirectly(original)) {
      const settled = await settleMutation(
        () =>
          updateItem({
            variables: {
              input: { id: original.id, version: original.version, ...changes },
            },
          }),
        { document: UpdateItemDocument, ...failureCopy, present: 'none' },
      );
      // Forbidden means the cached canEdit was stale (the item was published,
      // or ownership changed). This snapshot offered no suggestion, so the
      // read-only answer below takes it.
      if (settled.failure?.code !== ErrorCode.Forbidden) {
        if (settled.failure) {
          if (isVersionConflictCode(settled.failure.code)) {
            return { status: 'conflict', failure: settled.failure };
          }
          presentFailure(settled.failure);
          return FAILED;
        }
        await uploadImages(uploadItemImages, images, original.id);
        alertService.alert(
          t('suggestItemEdit.updatedTitle'),
          t('suggestItemEdit.updatedBody'),
        );
        return { status: 'updated' };
      }
    }

    // Last line of defence: `createItemSuggestion` takes PUBLIC items only, and
    // a rejected attempt still costs one of the 10 per hour. A PRIVATE item
    // this user doesn't own arrives with both flags false.
    if (!original.canSuggest) {
      alertService.alert(
        t('suggestItemEdit.readOnlyTitle'),
        t('suggestItemEdit.readOnlyBody'),
      );
      return { status: 'readOnly' };
    }

    const settled = await settleMutation(
      () =>
        suggestEdit({
          variables: { input: { itemId: original.id, note, changes } },
        }),
      { document: CreateItemSuggestionDocument, ...failureCopy },
    );
    const payload = appliedPayload(settled.data);
    if (settled.status === 'failed' || !payload) return FAILED;
    // The server collapses a byte-identical pending suggestion onto the
    // existing one and silently drops the new note, so a note that differs
    // from what we sent is the only signal that nothing new was recorded.
    const collapsed = payload.suggestion.note.trim() !== note;

    await uploadImages(uploadItemImages, images, original.id);
    alertService.alert(
      t(
        collapsed
          ? 'suggestItemEdit.duplicateTitle'
          : 'suggestItemEdit.sentTitle',
      ),
      t(
        collapsed
          ? 'suggestItemEdit.duplicateBody'
          : 'suggestItemEdit.sentBody',
      ),
    );
    return { status: collapsed ? 'duplicate' : 'suggested' };
  };

  return { submitEdit, loading: suggesting || updating || uploading };
}

/**
 * Returns how many photos actually landed. `uploadItemImages` stops at the
 * first fatal failure and returns a short array, alerting with the specific
 * reason itself — callers only decide what to report.
 */
async function uploadImages(
  upload: ReturnType<typeof useImageUpload>['uploadItemImages'],
  images: AddItemSubmitPayload['selectedImages'],
  itemId: string,
): Promise<number> {
  if (images.length === 0) return 0;
  let result;
  try {
    result = await upload(images, itemId);
  } catch (error) {
    errorService.reportError(error, {
      operation: 'Error uploading item images:',
    });
  }
  return !result ? 0 : result.length;
}
