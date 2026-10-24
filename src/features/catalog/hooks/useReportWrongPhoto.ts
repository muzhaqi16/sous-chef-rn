import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useReportItem } from '#features/catalog/hooks/useReportItem';

/** Moderators read every report in English, whatever language sent it. */
const WRONG_PHOTO_REPORT_REASON = 'The photo shows a different product.';

/**
 * Flags a catalog item whose photo shows something else, behind one confirm:
 * the reason is written for the user, so the only input is the decision.
 */
export function useReportWrongPhoto() {
  const { t } = useTranslation();
  const { reportItem, loading } = useReportItem();

  /** `imageId`: the approved photo on screen, which the report names. */
  const reportWrongPhoto = (itemId: string, imageId?: string) => {
    alertService.alert(
      t('reportItem.wrongPhotoConfirmTitle'),
      t('reportItem.wrongPhotoConfirmBody'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('reportItem.wrongPhotoConfirm'),
          onPress: () => {
            void reportItem(itemId, WRONG_PHOTO_REPORT_REASON, imageId);
          },
        },
      ],
    );
  };

  return { reportWrongPhoto, loading };
}
