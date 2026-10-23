import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useReportItem } from '#features/catalog/hooks/useReportItem';

/**
 * Flags a catalog item whose photo shows something else, behind one confirm:
 * the reason is written for the user, so the only input is the decision.
 */
export function useReportWrongPhoto() {
  const { t } = useTranslation();
  const { reportItem, loading } = useReportItem();

  const reportWrongPhoto = (itemId: string) => {
    alertService.alert(
      t('reportItem.wrongPhotoConfirmTitle'),
      t('reportItem.wrongPhotoConfirmBody'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('reportItem.wrongPhotoConfirm'),
          onPress: () => {
            void reportItem(itemId, t('reportItem.wrongPhotoReason'));
          },
        },
      ],
    );
  };

  return { reportWrongPhoto, loading };
}
