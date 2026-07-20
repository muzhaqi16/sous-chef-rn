import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { alertService } from '#/services/alertService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { alertMutationFailure } from './alertMutationFailure';

/**
 * Flags a catalog item for admin moderation with a free-text reason.
 *
 * This is a REPORT, not an edit proposal. It backs the autocomplete affordance,
 * where the user has only seen a name, brand and thumbnail and so has no basis
 * for filling in a structured diff. The barcode flow, where the user is looking
 * at the item's full details, uses `useSuggestItemEdit` instead.
 */
export function useReportItem() {
  const { t } = useTranslation();
  const [markForReview, { loading }] = useMutation(MarkItemForReviewDocument);

  const reportItem = async (
    itemId: string,
    reason: string,
  ): Promise<boolean> => {
    const result = await executeMutation(
      () =>
        markForReview({
          variables: { input: { itemId, reason: reason.trim() } },
        }),
      'Error reporting item:',
    );

    // A throw escaped Apollo's errorPolicy entirely — nothing to interpret.
    if (result === false) {
      alertMutationFailure(t, { keyPrefix: 'reportItem' });
      return false;
    }

    const payload = result.data?.markItemForReview;
    if (payload?.__typename === 'MarkItemForReviewPayload') {
      alertService.alert(t('reportItem.sentTitle'), t('reportItem.sentBody'));
      return true;
    }

    // The item is already flagged and waiting on an admin. Nothing went wrong
    // and a retry can't improve on it, so this counts as sent — reporting it as
    // a failure would invite the user to keep re-sending something that landed.
    if (payload?.__typename === 'ConflictError') {
      alertService.alert(
        t('reportItem.alreadyReportedTitle'),
        t('reportItem.alreadyReportedBody'),
      );
      return true;
    }

    alertMutationFailure(t, { keyPrefix: 'reportItem', result, payload });
    return false;
  };

  return { reportItem, loading };
}
