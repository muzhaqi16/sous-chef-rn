import { useMutation } from '@apollo/client/react';
import {
  CreateOutcome,
  type CreateUserReportInput,
} from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { isOfflineRejectedError } from '#/apollo/offlineQueue/OfflineRejectedError';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isNetworkError } from '#/utils/isNetworkError';
import { useTranslation } from '#/i18n';
import { CreateUserReportDocument } from './useReportContent.generated';

/** What became of a report. `body` is localized copy for the form to show. */
export type ReportOutcome =
  | { status: 'sent' | 'alreadyOpen' }
  | { status: 'failed'; body: string };

/**
 * Reports another user, optionally about one piece of their content. Not
 * `localFirst`: a report is never queued, so offline it fails and says why.
 */
export function useReportContent() {
  const { t } = useTranslation();
  const [createReport] = useMutation(CreateUserReportDocument);

  const reportContent = async (
    input: CreateUserReportInput,
  ): Promise<ReportOutcome> => {
    const settled = await settleMutation(
      () => createReport({ variables: { input } }),
      {
        document: CreateUserReportDocument,
        fallback: t('reports.failed'),
        present: 'none',
      },
    );

    if (settled.failure) {
      const unreachable =
        isOfflineRejectedError(settled.error) || isNetworkError(settled.error);
      return {
        status: 'failed',
        body: unreachable ? t('reports.needsConnection') : settled.failure.body,
      };
    }
    const payload = appliedPayload(settled.data);
    if (!payload) return { status: 'failed', body: t('reports.failed') };
    // MERGED: the caller's earlier report on this content is still open.
    return {
      status: payload.outcome === CreateOutcome.Merged ? 'alreadyOpen' : 'sent',
    };
  };

  return { reportContent };
}
