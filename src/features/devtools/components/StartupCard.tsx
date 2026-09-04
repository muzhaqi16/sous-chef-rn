import React from 'react';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { formatTime } from '#features/devtools/utils/formatMetrics';
import type { StartupMetrics } from '#features/devtools/hooks/usePerformanceDashboard';
import { MetricCard, MetricPanel, MetricRow } from './MetricCard';

export const StartupCard: React.FC<{ metrics: StartupMetrics }> = ({
  metrics,
}) => {
  const { t } = useTranslation();
  if (metrics.nativeLaunch === null && metrics.bundleLoad === null) return null;

  return (
    <MetricCard
      title={t('performance.startupMetrics')}
      subtitle={t('performance.startupMetricsSubtitle')}
    >
      <MetricPanel>
        {metrics.nativeLaunch !== null && (
          <MetricRow label={t('performance.nativeLaunch')}>
            <Text role="bodyStrong">{formatTime(metrics.nativeLaunch)}</Text>
          </MetricRow>
        )}
        {metrics.bundleLoad !== null && (
          <MetricRow label={t('performance.jsBundleLoad')}>
            <Text role="bodyStrong">{formatTime(metrics.bundleLoad)}</Text>
          </MetricRow>
        )}
      </MetricPanel>
    </MetricCard>
  );
};
