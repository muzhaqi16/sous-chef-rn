import React from 'react';
import { RowCard } from '#components/atoms/RowCard';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { useTranslation, type TranslationKey } from '#/i18n';
import {
  ModerationContentType,
  ReportStatus,
} from '#/graphql/generated/schemaTypes';
import { ListItem } from '#components/molecules/ListItem';
import { Text } from '#components/atoms/Text';
import type { BadgeVariant } from '#components/atoms/Badge';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { formatShortDate } from '#/utils/formatters/date';
import { REPORT_TYPE_LABEL_KEYS } from '#features/profile/utils/reportLabels';
import { profileTestIDs } from '#features/profile/testIDs';
import { MyReportRow_ReportFragmentDoc } from './MyReportRow.generated';

const SUBJECT_LABEL_KEYS: Record<ModerationContentType, TranslationKey> = {
  [ModerationContentType.Recipe]: 'reports.about.recipe',
  [ModerationContentType.RecipeReview]: 'reports.about.recipeReview',
  [ModerationContentType.Profile]: 'reports.about.profile',
};

const STATUS_LABEL_KEYS: Record<ReportStatus, TranslationKey> = {
  [ReportStatus.Pending]: 'reports.status.pending',
  [ReportStatus.Investigating]: 'reports.status.investigating',
  [ReportStatus.Resolved]: 'reports.status.resolved',
  [ReportStatus.Dismissed]: 'reports.status.dismissed',
};

const STATUS_BADGE: Record<ReportStatus, BadgeVariant> = {
  [ReportStatus.Pending]: 'default',
  [ReportStatus.Investigating]: 'primary',
  [ReportStatus.Resolved]: 'success',
  [ReportStatus.Dismissed]: 'default',
};

interface MyReportRowProps {
  reportRef: FragmentType<typeof MyReportRow_ReportFragmentDoc>;
}

/** One report as its reporter sees it: what it was about, why, when, and where it stands. */
export const MyReportRow: React.FC<MyReportRowProps> = ({ reportRef }) => {
  const { t } = useTranslation();
  const { data: report, complete } = useFragment({
    fragment: MyReportRow_ReportFragmentDoc,
    fragmentName: 'MyReportRow_report',
    from: reportRef,
  });

  if (!complete) return null;

  // The wire can carry a member this build's enum predates, which has no key.
  const labelOf = (key: TranslationKey | undefined) =>
    key ? t(key) : t('labels.unknown');

  return (
    <RowCard testID={profileTestIDs.reportRow(report.id)}>
      <ListItem
        title={labelOf(
          report.contentType
            ? SUBJECT_LABEL_KEYS[report.contentType]
            : 'reports.about.user',
        )}
        subtitle={
          <>
            <Text role={rowType.subtitle} tone="secondary">
              {labelOf(REPORT_TYPE_LABEL_KEYS[report.type])}
            </Text>
            <Text
              role={rowType.subtitle}
              tone="tertiary"
              style={commonStyles.rowTextGap}
            >
              {t('reports.reportedOn', {
                date: formatShortDate(new Date(report.createdAt)),
              })}
            </Text>
          </>
        }
        badge={{
          text: labelOf(STATUS_LABEL_KEYS[report.status]),
          variant: STATUS_BADGE[report.status],
        }}
      />
    </RowCard>
  );
};
