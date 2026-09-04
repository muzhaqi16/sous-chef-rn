import React from 'react';
import { useTranslation } from '#/i18n';
import { formatTime } from '#features/devtools/utils/formatMetrics';
import type { RenderMetrics } from '#/services/performance/types';
import { MetricCard } from './MetricCard';
import { MetricTable, type MetricColumn } from './MetricTable';

export const SlowestComponentsCard: React.FC<{
  metrics: RenderMetrics[];
}> = ({ metrics }) => {
  const { t } = useTranslation();
  if (metrics.length === 0) return null;

  const columns: MetricColumn<RenderMetrics>[] = [
    {
      role: 'name',
      label: t('performance.component'),
      value: m => m.componentName,
    },
    {
      role: 'avg',
      label: t('performance.avg'),
      value: m => formatTime(m.avgRenderTime),
    },
    {
      role: 'max',
      label: t('performance.max'),
      value: m => formatTime(m.maxRenderTime),
    },
    {
      role: 'total',
      label: t('performance.total'),
      value: m => formatTime(m.totalRenderTime),
    },
    { role: 'count', label: t('performance.count'), value: m => m.renderCount },
  ];

  return (
    <MetricCard
      title={t('performance.slowestComponents')}
      subtitle={t('performance.slowestComponentsSubtitle')}
    >
      <MetricTable
        columns={columns}
        rows={metrics}
        rowKey={m => m.componentName}
      />
    </MetricCard>
  );
};
