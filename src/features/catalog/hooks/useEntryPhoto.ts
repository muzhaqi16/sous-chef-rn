import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  DeleteHomeItemPhotoDocument,
  UpdateHomeItemPhotoDocument,
} from '#features/catalog/hooks/useEntryPhoto.generated';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { imageErrorMessage, useImageUpload } from '#hooks/data/useImageUpload';
import { alertService } from '#/services/alertService';
import type { ImageFile } from '#/types/media';

/**
 * The photo a household's entries for one catalog item show: its own upload,
 * one of the item's photos, or the catalog's again. Each answers whether the
 * change landed; a failure is already reported. Never queued: an upload needs
 * the network, and a pick or revert without one is told so.
 */
export function useEntryPhoto(
  homeId: string | null | undefined,
  itemId: string | null | undefined,
) {
  const { t } = useTranslation();
  const { uploadUnconfirmed } = useImageUpload();
  const [updatePhoto] = useMutation(UpdateHomeItemPhotoDocument);
  const [clearPhoto] = useMutation(DeleteHomeItemPhotoDocument);
  const [busy, setBusy] = useState(false);

  const failure = {
    title: t('entryPhoto.failedTitle'),
    fallback: t('entryPhoto.failedBody'),
  };

  const run = async (
    write: (home: string, item: string) => Promise<boolean>,
  ) => {
    if (!homeId || !itemId) return false;
    setBusy(true);
    const landed = await write(homeId, itemId);
    setBusy(false);
    return landed;
  };

  const setPhoto = async (
    home: string,
    item: string,
    choice: { uploadKey: string } | { itemImageId: string },
  ) => {
    const settled = await settleMutation(
      () =>
        updatePhoto({
          variables: { input: { homeId: home, itemId: item, ...choice } },
        }),
      { document: UpdateHomeItemPhotoDocument, ...failure },
    );
    return settled.status === 'applied';
  };

  const upload = async (home: string, item: string, file: ImageFile) => {
    try {
      return await uploadUnconfirmed(
        file,
        ImageUploadPurpose.HouseholdItemPhoto,
        { homeId: home, itemId: item },
      );
    } catch (error) {
      alertService.alert(failure.title, imageErrorMessage(t, error, false));
      return undefined;
    }
  };

  const setOwnPhoto = (file: ImageFile) =>
    run(async (home, item) => {
      const uploadKey = await upload(home, item, file);
      // `null` is offline, which the upload leaves to its caller to say.
      if (uploadKey === null) {
        alertService.alert(
          t('imageUpload.offlineTitle'),
          t('imageUpload.offlineBody'),
        );
      }
      if (!uploadKey) return false;
      return setPhoto(home, item, { uploadKey });
    });

  const pickItemPhoto = (itemImageId: string) =>
    run((home, item) => setPhoto(home, item, { itemImageId }));

  const revertToCatalogPhoto = () =>
    run(async (home, item) => {
      const settled = await settleMutation(
        () =>
          clearPhoto({ variables: { input: { homeId: home, itemId: item } } }),
        { document: DeleteHomeItemPhotoDocument, ...failure },
      );
      return settled.status === 'applied';
    });

  return { setOwnPhoto, pickItemPhoto, revertToCatalogPhoto, busy };
}
