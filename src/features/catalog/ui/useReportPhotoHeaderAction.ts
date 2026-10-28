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
 * A detail screen's photo action, following the page its `GalleryHero` reports
 * through `onPageChange`: "report wrong photo" naming the catalog photo shown,
 * none over the household's own upload. On the user's upload awaiting review it
 * explains instead, as the API returns a PENDING photo to its submitter alone.
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
  let photoId: string | undefined;
  if (gallery.photos.length > 0) {
    // A page showing no catalog photo is the household's own upload.
    if (!shown) return none;
    photoId = shown.id;
  } else {
    // A single hero is the entry's image; `imageUrl` is approved-only.
    photoId = image?.catalogImageId ?? undefined;
    if (image?.source === EntryImageSource.Household && !photoId) return none;
    if (!photoId && !item.imageUrl) return none;
  }

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
