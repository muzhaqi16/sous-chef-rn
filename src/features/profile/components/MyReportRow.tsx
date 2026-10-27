import React from 'react';
import { RowCard } from '#components/atoms/RowCard';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { useTranslation, type TranslationKey } from '#/i18n';
import {
  ModerationContentType,
  ReviewSubmissionStatus,
} from '#/graphql/generated/schemaTypes';
import { ListItem } from '#components/molecules/ListItem';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import type { BadgeVariant } from '#components/atoms/Badge';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { formatShortDate } from '#/utils/formatters/date';
import { photoDisplayUrl, type PhotoLike } from '#utils/imageUtils';
import { REPORT_TYPE_LABEL_KEYS } from '#features/profile/utils/reportLabels';
import { profileTestIDs } from '#features/profile/testIDs';
import {
  MyReportRow_SubmissionFragmentDoc,
  type MyReportRow_SubmissionFragment,
} from './MyReportRow.generated';

const SUBJECT_LABEL_KEYS: Record<ModerationContentType, TranslationKey> = {
  [ModerationContentType.Recipe]: 'reports.about.recipe',
  [ModerationContentType.RecipeReview]: 'reports.about.recipeReview',
  [ModerationContentType.Profile]: 'reports.about.profile',
};

/** An outcome reads differently for a report, an edit and a photo. */
type Outcome = 'report' | 'suggestion' | 'photo';

const ACCEPTED_LABEL_KEYS: Record<Outcome, TranslationKey> = {
  report: 'reports.status.upheld',
  suggestion: 'reports.status.accepted',
  photo: 'reports.status.approved',
};

const DECLINED_LABEL_KEYS: Record<Outcome, TranslationKey> = {
  report: 'reports.status.closed',
  suggestion: 'reports.status.declined',
  photo: 'reports.status.notApproved',
};

const STATUS_BADGE: Record<ReviewSubmissionStatus, BadgeVariant> = {
  [ReviewSubmissionStatus.Pending]: 'default',
  [ReviewSubmissionStatus.InReview]: 'primary',
  [ReviewSubmissionStatus.Accepted]: 'success',
  [ReviewSubmissionStatus.Declined]: 'default',
};

function statusLabelKey(
  status: ReviewSubmissionStatus,
  outcome: Outcome,
): TranslationKey | undefined {
  switch (status) {
    case ReviewSubmissionStatus.Pending:
      return 'reports.status.pending';
    case ReviewSubmissionStatus.InReview:
      return 'reports.status.inReview';
    case ReviewSubmissionStatus.Accepted:
      return ACCEPTED_LABEL_KEYS[outcome];
    case ReviewSubmissionStatus.Declined:
      return DECLINED_LABEL_KEYS[outcome];
    default:
      // The wire can carry a status this build's enum predates.
      return undefined;
  }
}

interface Described {
  kind: TranslationKey;
  reason?: TranslationKey;
  /** What it was about: a recipe, a person or an item; null when unnamed. */
  subject: string | null;
  photo: PhotoLike | null;
  outcome: Outcome;
}

function describe(submission: MyReportRow_SubmissionFragment): Described {
  switch (submission.__typename) {
    case 'UserReportSubmission': {
      const { report, recipe, reportedUser } = submission;
      return {
        kind: report.contentType
          ? SUBJECT_LABEL_KEYS[report.contentType]
          : 'reports.about.user',
        reason: REPORT_TYPE_LABEL_KEYS[report.type],
        subject: recipe?.name ?? reportedUser.displayName,
        photo: null,
        outcome: 'report',
      };
    }
    case 'ItemReportSubmission':
      return {
        kind: submission.photo ? 'reports.about.photo' : 'reports.about.item',
        subject: submission.item.name,
        photo: submission.photo,
        outcome: 'report',
      };
    case 'ItemSuggestionSubmission':
      return {
        kind: 'reports.about.suggestion',
        subject: submission.item.name,
        photo: null,
        outcome: 'suggestion',
      };
    case 'ItemPhotoSubmission':
      return {
        kind: 'reports.about.photoUpload',
        subject: submission.item.name,
        photo: submission.photo,
        outcome: 'photo',
      };
  }
}

interface MyReportRowProps {
  reportRef: FragmentType<typeof MyReportRow_SubmissionFragmentDoc>;
}

/**
 * One thing the viewer sent for review, as they see it: what it was about,
 * their note and any reviewer's, when, and where it stands.
 */
export const MyReportRow: React.FC<MyReportRowProps> = ({ reportRef }) => {
  const { t } = useTranslation();
  const { data: submission, complete } = useFragment({
    fragment: MyReportRow_SubmissionFragmentDoc,
    fragmentName: 'MyReportRow_submission',
    from: reportRef,
  });

  if (!complete) return null;

  // The wire can carry a member this build's enum predates, which has no key.
  const labelOf = (key: TranslationKey | undefined) =>
    key ? t(key) : t('labels.unknown');
  const { kind, reason, subject, photo, outcome } = describe(submission);
  const about = [t(kind), reason ? labelOf(reason) : null]
    .filter(part => part !== null)
    .join(' · ');

  return (
    <RowCard testID={profileTestIDs.reportRow(submission.id)}>
      <ListItem
        title={subject ?? about}
        leftElement={
          <RowThumbnail uri={photo ? photoDisplayUrl(photo, 'small') : null} />
        }
        subtitle={
          <>
            {subject ? (
              <Text role={rowType.subtitle} tone="secondary">
                {about}
              </Text>
            ) : null}
            {submission.senderNote ? (
              <Text
                role={rowType.subtitle}
                tone="secondary"
                numberOfLines={2}
                style={commonStyles.rowTextGap}
              >
                {submission.senderNote}
              </Text>
            ) : null}
            {submission.reviewNote ? (
              <Text
                role={rowType.subtitle}
                tone="secondary"
                style={commonStyles.rowTextGap}
              >
                {t('reports.reviewNote', { note: submission.reviewNote })}
              </Text>
            ) : null}
            <Text
              role={rowType.subtitle}
              tone="tertiary"
              style={commonStyles.rowTextGap}
            >
              {t('reports.sentOn', {
                date: formatShortDate(new Date(submission.sentAt)),
              })}
            </Text>
          </>
        }
        badge={{
          text: labelOf(statusLabelKey(submission.status, outcome)),
          variant: STATUS_BADGE[submission.status],
        }}
      />
    </RowCard>
  );
};
