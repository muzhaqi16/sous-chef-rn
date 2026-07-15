import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import {
  MarkItemForReviewDocument,
  type MarkItemForReviewMutation,
} from '#operations/item/item.generated';
import { alertService } from '#/services/alertService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';

type ReportPayload = MarkItemForReviewMutation['markItemForReview'];

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
      alertFailure(t);
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

    alertFailure(t, result, payload);
    return false;
  };

  return { reportItem, loading };
}

// Minimal structural type for the translation function so this doesn't depend
// on i18next's generic `TFunction` namespace typing.
type Translate = (key: string, options?: Record<string, unknown>) => string;

function alertFailure(
  t: Translate,
  result?: { error?: unknown },
  payload?: ReportPayload,
): void {
  // Per-operation rate limits arrive as a TOP-LEVEL GraphQL error, never a
  // union member — check before falling through to the union branches.
  if (result && isRateLimitError(result.error)) {
    alertService.alert(
      t('reportItem.rateLimitedTitle'),
      getRateLimitMessage(result.error),
    );
    return;
  }

  switch (payload?.__typename) {
    case 'NotFoundError':
      alertService.alert(
        t('reportItem.notFoundTitle'),
        t('reportItem.notFoundBody'),
      );
      return;
    case 'ValidationError':
      // Server-authored and field-specific — the most useful thing we have.
      alertService.alert(
        t('reportItem.rejectedTitle'),
        payload.message || t('reportItem.failedBody'),
      );
      return;
    default:
      alertService.alert(
        t('reportItem.failedTitle'),
        t('reportItem.failedBody'),
      );
  }
}
