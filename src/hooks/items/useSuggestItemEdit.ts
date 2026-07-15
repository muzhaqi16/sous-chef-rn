import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import {
  SuggestItemEditDocument,
  UpdateItemDocument,
  type SuggestItemEditMutation,
  type UpdateItemMutation,
} from './useSuggestItemEdit.generated';
import { useIsAdminUser } from '#store/useAppStore';
import { useImageUpload } from '#hooks/useImageUpload';
import { alertService } from '#/services/alertService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';
import {
  buildSuggestibleItemChanges,
  resolveItemEditRoute,
  type EditableItemSnapshot,
} from '#utils/items/suggestItemChanges';
import type { AddItemSubmitPayload } from '#/components/organisms/AddItemForm/AddItemForm';

export type ItemEditResult =
  | { status: 'suggested' }
  | { status: 'duplicate' }
  | { status: 'updated' }
  | { status: 'imagesOnly' }
  | { status: 'noChanges' }
  | { status: 'failed' };

type SuggestPayload = SuggestItemEditMutation['suggestItemEdit'];
type UpdatePayload = UpdateItemMutation['updateItem'];

const FAILED: ItemEditResult = { status: 'failed' };

/**
 * `errorPolicy: 'all'` is set globally, so Apollo mutations resolve with
 * `{ data, error }` instead of throwing. `executeMutation` is therefore the net
 * for genuine network throws, not the error path — the union and `result.error`
 * below are what actually carry server outcomes.
 */
type MutationResult<TData> = { data?: TData | null; error?: unknown };

export function useSuggestItemEdit() {
  const { t } = useTranslation();
  const isAdmin = useIsAdminUser();
  const { uploadItemImages } = useImageUpload();

  const [suggestEdit, { loading: suggesting }] = useMutation(
    SuggestItemEditDocument,
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
      await uploadImages(uploadItemImages, images, original.id);
      alertService.alert(
        t('suggestItemEdit.photosOnlyTitle'),
        t('suggestItemEdit.photosOnlyBody'),
      );
      return { status: 'imagesOnly' };
    }

    if (resolveItemEditRoute(original.visibility, isAdmin) === 'direct') {
      const result = (await executeMutation(
        () =>
          updateItem({
            variables: {
              input: {
                id: original.id,
                ...changes,
                editReason: note || undefined,
              },
            },
          }),
        'Error updating item:',
      )) as MutationResult<UpdateItemMutation> | false;

      const outcome = result === false ? null : interpretUpdate(result);
      if (outcome === 'updated') {
        await uploadImages(uploadItemImages, images, original.id);
        alertService.alert(
          t('suggestItemEdit.updatedTitle'),
          t('suggestItemEdit.updatedBody'),
        );
        return { status: 'updated' };
      }
      // Anything other than a Forbidden "use suggestItemEdit instead" is a real
      // failure. Forbidden means our visibility guess was wrong or stale, so do
      // what the server asked and fall through to the suggestion path.
      if (outcome !== 'forbidden') {
        alertFailure(
          t,
          result === false ? undefined : result,
          result === false ? undefined : result.data?.updateItem,
        );
        return FAILED;
      }
    }

    const result = (await executeMutation(
      () =>
        suggestEdit({
          variables: { input: { itemId: original.id, note, changes } },
        }),
      'Error suggesting item edit:',
    )) as MutationResult<SuggestItemEditMutation> | false;

    if (result === false) return FAILED;

    const payload = result.data?.suggestItemEdit;
    if (payload?.__typename === 'SuggestItemEditPayload') {
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

    alertFailure(t, result, payload);
    return FAILED;
  };

  return { submitEdit, loading: suggesting || updating };
}

async function uploadImages(
  upload: ReturnType<typeof useImageUpload>['uploadItemImages'],
  images: AddItemSubmitPayload['selectedImages'],
  itemId: string,
): Promise<void> {
  if (images.length === 0) return;
  await executeMutation(
    () => upload(images, itemId),
    'Error uploading item images:',
  );
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

type TFunc = ReturnType<typeof useTranslation>['t'];

function alertFailure(
  t: TFunc,
  result?: MutationResult<unknown>,
  payload?: SuggestPayload | UpdatePayload,
): void {
  // The 10/hour cap is a TOP-LEVEL GraphQL error, never a union member — check
  // it before falling through to the union branches.
  if (result && isRateLimitError(result.error)) {
    alertService.alert(
      t('suggestItemEdit.rateLimitedTitle'),
      getRateLimitMessage(result.error),
    );
    return;
  }

  switch (payload?.__typename) {
    case 'ConflictError':
      alertService.alert(
        t('suggestItemEdit.pendingCapTitle'),
        t('suggestItemEdit.pendingCapBody'),
      );
      return;
    case 'NotFoundError':
      alertService.alert(
        t('suggestItemEdit.notFoundTitle'),
        t('suggestItemEdit.notFoundBody'),
      );
      return;
    case 'ValidationError':
      // Server-authored and field-specific — the most useful thing we have.
      alertService.alert(
        t('suggestItemEdit.rejectedTitle'),
        payload.message || t('suggestItemEdit.failedBody'),
      );
      return;
    default:
      alertService.alert(
        t('suggestItemEdit.failedTitle'),
        t('suggestItemEdit.failedBody'),
      );
  }
}
