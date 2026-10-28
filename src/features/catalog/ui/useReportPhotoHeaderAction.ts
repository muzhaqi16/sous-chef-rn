import { useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  EntryImageSource,
  ItemImageStatus,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { useReportWrongPhoto } from '#features/catalog/hooks/useReportWrongPhoto';
import type { EntryImageRead } from '#features/catalog/ui/entryGallery';
import {
  useItemPhoto,
  type ItemPhotoRef,
} from '#features/catalog/ui/useItemPhoto';

/** The hero's pages, as `entryGallery` returns them. */
interface HeroGallery {
  leadImageUrl: string | null;
  photos: readonly ItemPhotoRef[];
}

// A leading page is the household's own upload, which is nobody's to review.
function photoOnPage(gallery: HeroGallery, page: number): ItemPhotoRef | null {
  return gallery.photos[gallery.leadImageUrl ? page - 1 : page] ?? null;
}

/**
 * A detail screen's photo action, spread into its actions, following the page
 * its `GalleryHero` reports through `onPageChange`.
 *
 * On the user's own upload awaiting review the flag carries a clock and
 * explains instead of reporting: the API returns a PENDING photo to its
 * submitter alone, so it must not read as live.
 *
 * Otherwise "report wrong photo", for a public catalog item showing an approved
 * catalog photo (`imageUrl` is approved-only), naming it by the entry's
 * `catalogImageId`. None for the household's own upload.
 */
export function useReportPhotoHeaderAction(
  item:
    | { id: string; canSuggest?: boolean | null; imageUrl?: string | null }
    | null
    | undefined,
  image: Pick<EntryImageRead, 'catalogImageId' | 'source'> | null | undefined,
  gallery: HeroGallery,
  testID: string,
): { actions: HeaderAction[]; onPageChange: (page: number) => void } {
  const { t } = useTranslation();
  const { reportWrongPhoto, loading } = useReportWrongPhoto();
  const [page, setPage] = useState(0);
  const shown = useItemPhoto(photoOnPage(gallery, page));

  if (shown?.status === ItemImageStatus.Pending) {
    const explain = () =>
      alertService.alert(
        t('itemPhotos.pendingReview'),
        t('itemPhotos.pendingReviewBody'),
      );
    return {
      actions: [
        {
          icon: 'flag-outline',
          mark: 'time-outline',
          accessibilityLabel: t('itemPhotos.pendingReviewAction'),
          onPress: explain,
          testID,
        },
      ],
      onPageChange: setPage,
    };
  }

  const none = { actions: [], onPageChange: setPage };
  if (!item?.canSuggest) return none;
  const photoId = image?.catalogImageId ?? undefined;
  // A household photo with no catalog photo behind it is its own upload.
  if (image?.source === EntryImageSource.Household && !photoId) return none;
  if (!photoId && !item.imageUrl) return none;

  const itemId = item.id;
  return {
    actions: [
      {
        icon: 'flag-outline',
        accessibilityLabel: t('reportItem.wrongPhotoAction'),
        onPress: () => reportWrongPhoto(itemId, photoId),
        loading,
        testID,
      },
    ],
    onPageChange: setPage,
  };
}
