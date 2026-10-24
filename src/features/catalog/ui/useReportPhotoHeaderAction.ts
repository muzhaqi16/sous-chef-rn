import { useTranslation } from '#/i18n';
import { EntryImageSource } from '#/graphql/generated/schemaTypes';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { useReportWrongPhoto } from '#features/catalog/hooks/useReportWrongPhoto';
import type { EntryImageRead } from '#features/catalog/ui/entryGallery';

/**
 * A detail screen's "report wrong photo", spread into its actions: one entry
 * for a public catalog item showing an approved catalog photo (`imageUrl` is
 * approved-only), naming it by the entry's `catalogImageId`. None for the
 * household's own upload, which is nobody's to review.
 */
export function useReportPhotoHeaderAction(
  item:
    | { id: string; canSuggest?: boolean | null; imageUrl?: string | null }
    | null
    | undefined,
  image: Pick<EntryImageRead, 'catalogImageId' | 'source'> | null | undefined,
  testID: string,
): HeaderAction[] {
  const { t } = useTranslation();
  const { reportWrongPhoto, loading } = useReportWrongPhoto();
  if (!item?.canSuggest) return [];
  const photoId = image?.catalogImageId ?? undefined;
  // A household photo with no catalog photo behind it is its own upload.
  if (image?.source === EntryImageSource.Household && !photoId) return [];
  if (!photoId && !item.imageUrl) return [];

  const itemId = item.id;
  return [
    {
      icon: 'flag-outline',
      accessibilityLabel: t('reportItem.wrongPhotoAction'),
      onPress: () => reportWrongPhoto(itemId, photoId),
      loading,
      testID,
    },
  ];
}
