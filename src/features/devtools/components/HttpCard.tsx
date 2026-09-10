import React from 'react';
import { useTranslation } from '#/i18n';
import { formatTime } from '#features/devtools/utils/formatMetrics';
import type { HttpRequestMetric } from '#features/devtools/hooks/usePerformanceDashboard';
import { MetricCard } from './MetricCard';
import { MetricTable, type MetricColumn } from './MetricTable';

export const HttpCard: React.FC<{ requests: HttpRequestMetric[] }> = ({
  requests,
}) => {
  const { t } = useTranslation();
  if (requests.length === 0) return null;

  const columns: MetricColumn<HttpRequestMetric>[] = [
    { role: 'name', label: t('performance.host'), value: r => r.host },
    {
      role: 'avg',
      label: t('performance.duration'),
      value: r => formatTime(r.duration),
    },
  ];

  return (
    <MetricCard
      title={t('performance.httpSummary')}
      subtitle={t('performance.httpSummarySubtitle', {
        count: requests.length,
      })}
    >
      <MetricTable
        columns={columns}
        rows={requests}
        rowKey={(r, index) => `${r.url}-${index}`}
      />
    </MetricCard>
  );
};
