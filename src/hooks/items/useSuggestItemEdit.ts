import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import {
  CreateItemSuggestionDocument,
  UpdateItemDocument,
  type UpdateItemMutation,
} from './useSuggestItemEdit.generated';
import { useImageUpload } from '#hooks/useImageUpload';
import { alertService } from '#/services/alertService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  alertMutationFailure,
  type AlertCaseKeySuffixes,
} from './alertMutationFailure';
import {
  buildSuggestibleItemChanges,
  type EditableItemSnapshot,
} from '#utils/items/suggestItemChanges';
import type { AddItemSubmitPayload } from '#/components/organisms/AddItemForm/AddItemForm';

export type ItemEditResult =
  | { status: 'suggested' }
  | { status: 'duplicate' }
  | { status: 'updated' }
  | { status: 'imagesOnly' }
  | { status: 'noChanges' }
  | { status: 'readOnly' }
  | { status: 'failed' };

const FAILED: ItemEditResult = { status: 'failed' };

// The 5-pending cap is the only CONFLICT either mutation raises, so the
// typename alone identifies it. Should a second conflict appear, key on
// `payload.code` instead — this copy would be actively wrong for it.
//
// The values are i18n key suffixes, not whole keys: `alertMutationFailure`
// composes each under the call's `keyPrefix`, which is `'suggestItemEdit'` at
// both sites below — so `'pendingCapTitle'` resolves
// `suggestItemEdit.pendingCapTitle`.
const SUGGEST_FAILURE_CASES: Record<string, AlertCaseKeySuffixes> = {
  ConflictError: {
    titleSuffix: 'pendingCapTitle',
    bodySuffix: 'pendingCapBody',
  },
};

/**
 * The slice of an Apollo mutation result the helpers below read. Structural on
 * purpose: they take whatever `executeMutation` inferred rather than naming
 * Apollo's result type, so neither helper has to be retyped when it changes.
 *
 * `errorPolicy: 'all'` is set globally, so mutations resolve with
 * `{ data, error }` instead of throwing. `executeMutation` is therefore the net
 * for genuine network throws, not the error path — the result union and
 * `result.error` are what actually carry server outcomes.
 */
type MutationResult<TData> = { data?: TData | null; error?: unknown };

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

  const submitEdit = async (
    original: EditableItemSnapshot,
    formData: AddItemSubmitPayload,
  ): Promise<ItemEditResult> => {
    const note = String(formData.editReason ?? '').trim();
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
    // inferring from visibility. canEdit wins when both are true (an admin on a
    // public item) — a direct write needs no review.
    if (original.canEdit) {
      const result = await executeMutation(
        () =>
          updateItem({
            variables: {
              input: {
                id: original.id,
                ...changes,
              },
            },
          }),
        'Error updating item:',
      );

      // A throw escaped Apollo's errorPolicy entirely — nothing to interpret.
      if (result === false) {
        alertMutationFailure(t, { keyPrefix: 'suggestItemEdit' });
        return FAILED;
      }

      const outcome = interpretUpdate(result);
      if (outcome === 'updated') {
        await uploadImages(uploadItemImages, images, original.id);
        alertService.alert(
          t('suggestItemEdit.updatedTitle'),
          t('suggestItemEdit.updatedBody'),
        );
        return { status: 'updated' };
      }
      // Anything other than a Forbidden "use createItemSuggestion instead" is a real
      // failure. Forbidden means the cached canEdit was stale (the item was
      // published, or ownership changed), so do what the server asked and fall
      // through to the suggestion path.
      if (outcome !== 'forbidden') {
        alertMutationFailure(t, {
          keyPrefix: 'suggestItemEdit',
          result,
          payload: result.data?.updateItem,
          extraCases: SUGGEST_FAILURE_CASES,
        });
        return FAILED;
      }
    }

    // Reached either by never having had canEdit, or by a stale one that the
    // server just refused — both still need the item to be a legal suggestion
    // target. It isn't for a PRIVATE item this user doesn't own (a housemate's
    // pantry entry, a shared list's item, a recipe ingredient), which arrives
    // with both flags false. The form should not have opened for one, so this
    // is the last line of defence: createItemSuggestion takes PUBLIC items only
    // and the rejected attempt would still cost one of the 10 per hour.
    if (!original.canSuggest) {
      alertService.alert(
        t('suggestItemEdit.readOnlyTitle'),
        t('suggestItemEdit.readOnlyBody'),
      );
      return { status: 'readOnly' };
    }

    const result = await executeMutation(
      () =>
        suggestEdit({
          variables: { input: { itemId: original.id, note, changes } },
        }),
      'Error suggesting item edit:',
    );

    if (result === false) {
      alertMutationFailure(t, { keyPrefix: 'suggestItemEdit' });
      return FAILED;
    }

    const payload = result.data?.createItemSuggestion;
    if (payload?.__typename === 'CreateItemSuggestionPayload') {
      await uploadImages(uploadItemImages, images, original.id);
      // The server collapses a byte-identical pending suggestion onto the
      // existing one and silently drops the new note, so a note that differs
      // from what we sent is the only signal that nothing new was recorded.
      const collapsed = payload.suggestion.note.trim() !== note;
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
    }

    alertMutationFailure(t, {
      keyPrefix: 'suggestItemEdit',
      result,
      payload,
      extraCases: SUGGEST_FAILURE_CASES,
    });
    return FAILED;
  };

  return { submitEdit, loading: suggesting || updating || uploading };
}

/**
 * Returns how many photos actually landed.
 *
 * `uploadItemImages` stops the run at the first fatal failure (rate limit,
 * offline) and returns a short array, so the count is the only way to tell a
 * successful submission from one where nothing reached the server. It alerts
 * with the specific reason itself, so callers only decide what to report.
 */
async function uploadImages(
  upload: ReturnType<typeof useImageUpload>['uploadItemImages'],
  images: AddItemSubmitPayload['selectedImages'],
  itemId: string,
): Promise<number> {
  if (images.length === 0) return 0;
  const result = await executeMutation(
    () => upload(images, itemId),
    'Error uploading item images:',
  );
  return result === false ? 0 : result.length;
}

/** 'updated' | 'forbidden' | null (any other failure). */
function interpretUpdate(
  result: MutationResult<UpdateItemMutation>,
): 'updated' | 'forbidden' | null {
  const payload = result.data?.updateItem;
  if (payload?.__typename === 'UpdateItemPayload') return 'updated';
  if (payload?.__typename === 'ForbiddenError') return 'forbidden';
  return null;
}
