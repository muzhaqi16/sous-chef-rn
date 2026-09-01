import React from 'react';
import { useTranslation } from '#/i18n';
import { ClickableInfoPanel } from '#components/molecules/ClickableInfoPanel';
import { formatDate } from '#features/pantry/hooks/usePantryItemTransformation';
import type { UsageRecord } from './UsageHistoryRow';

interface PantryUsageHistoryProps {
  usageRecords: ReadonlyArray<{ node: UsageRecord }>;
  /** Every record, not just the slice the detail query fetched. */
  totalCount?: number;
  onViewAll: () => void;
}

/**
 * A summary, not the ledger: usage records are append-only and never pruned, so
 * the full list belongs on its own paginated screen.
 */
export const PantryUsageHistory: React.FC<PantryUsageHistoryProps> = ({
  usageRecords,
  totalCount,
  onViewAll,
}) => {
  const { t } = useTranslation();
  if (usageRecords.length === 0) return null;

  const latest = usageRecords[0]?.node;
  const count = totalCount ?? usageRecords.length;
  // `formatDate` returns null for an unparseable stamp; the row is dropped
  // rather than rendering an empty value.
  const latestDate = latest ? formatDate(latest.usedAt) : null;

  return (
    <ClickableInfoPanel
      title={t('pantryItemDetail.usageHistory')}
      onPress={onViewAll}
      items={[
        { label: t('pantryItemDetail.usage.entries'), value: count },
        ...(latestDate
          ? [
              {
                label: t('pantryItemDetail.usage.mostRecent'),
                value: latestDate,
              },
            ]
          : []),
      ]}
    />
  );
};
