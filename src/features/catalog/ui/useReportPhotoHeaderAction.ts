import { useTranslation } from '#/i18n';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { useReportWrongPhoto } from '#features/catalog/hooks/useReportWrongPhoto';

/**
 * A detail screen's "report wrong photo", spread into its actions: one entry
 * for a public catalog item showing an approved photo (`imageUrl` is
 * approved-only), none otherwise.
 */
export function useReportPhotoHeaderAction(
  item:
    | { id: string; canSuggest?: boolean | null; imageUrl?: string | null }
    | null
    | undefined,
  testID: string,
): HeaderAction[] {
  const { t } = useTranslation();
  const { reportWrongPhoto, loading } = useReportWrongPhoto();
  if (!item?.canSuggest || !item.imageUrl) return [];

  const itemId = item.id;
  return [
    {
      icon: 'flag-outline',
      accessibilityLabel: t('reportItem.wrongPhotoAction'),
      onPress: () => reportWrongPhoto(itemId),
      loading,
      testID,
    },
  ];
}
