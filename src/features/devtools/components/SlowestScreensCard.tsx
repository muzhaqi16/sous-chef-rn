import React from 'react';
import { useTranslation } from '#/i18n';
import { formatTime } from '#features/devtools/utils/formatMetrics';
import type { ScreenMetrics } from '#/services/performance/types';
import { MetricCard } from './MetricCard';
import { MetricTable, type MetricColumn } from './MetricTable';

export const SlowestScreensCard: React.FC<{ metrics: ScreenMetrics[] }> = ({
  metrics,
}) => {
  const { t } = useTranslation();
  if (metrics.length === 0) return null;

  const columns: MetricColumn<ScreenMetrics>[] = [
    { role: 'name', label: t('performance.screen'), value: m => m.screenName },
    {
      role: 'avg',
      label: t('performance.avg'),
      value: m => formatTime(m.avgInteractiveTime),
    },
    {
      role: 'max',
      label: t('performance.max'),
      value: m => formatTime(m.maxInteractiveTime),
    },
    {
      role: 'count',
      label: t('performance.count'),
      value: m => m.transitionCount,
    },
  ];

  return (
    <MetricCard
      title={t('performance.slowestScreens')}
      subtitle={t('performance.slowestScreensSubtitle')}
    >
      <MetricTable
        columns={columns}
        rows={metrics}
        rowKey={m => m.screenName}
      />
    </MetricCard>
  );
};
