import React from 'react';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { useFPSMonitor } from '#features/devtools/hooks/useFPSMonitor';
import { MetricCard, MetricPanel, MetricRow } from './MetricCard';

/**
 * Owns its own `useFPSMonitor` call so the 10/sec FPS updates re-render this
 * card alone, not the dashboard with its table sorts and metric derivations.
 */
export const FpsCard: React.FC = () => {
  const { t } = useTranslation();
  const { fps, isLowFPS, stats } = useFPSMonitor();

  return (
    <MetricCard
      title={t('performance.liveFps')}
      subtitle={t('performance.fpsSubtitle')}
    >
      <MetricPanel>
        <MetricRow label={t('performance.currentFps')}>
          <Text role="bodyStrong" tone={isLowFPS ? 'error' : undefined}>
            {fps}
          </Text>
        </MetricRow>
        <MetricRow label={t('performance.minAvgMax')}>
          <Text role="bodyStrong">
            {stats.min} / {stats.avg} / {stats.max}
          </Text>
        </MetricRow>
        <MetricRow label={t('performance.lowFpsEvents')}>
          <Text
            role="bodyStrong"
            tone={stats.lowFPSCount > 0 ? 'warning' : undefined}
          >
            {stats.lowFPSCount}
          </Text>
        </MetricRow>
      </MetricPanel>
    </MetricCard>
  );
};
