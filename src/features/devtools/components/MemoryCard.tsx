import React from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import type { MemorySnapshot } from '#/services/performance/types';
import {
  formatMemory,
  formatTimestamp,
} from '#features/devtools/utils/formatMetrics';
import { MetricCard, MetricPanel, MetricRow } from './MetricCard';
import { styles } from './dashboardStyles';

/**
 * Threshold-colored value. The tone lives here so the parent reads no theme.
 */
const ThresholdText: React.FC<{
  children: React.ReactNode;
  usagePercent: number;
  role?: 'bodyStrong' | 'heading';
  baseStyle?: StyleProp<TextStyle>;
}> = ({ children, usagePercent, role = 'bodyStrong', baseStyle }) => {
  const tone =
    usagePercent > 95 ? 'error' : usagePercent > 80 ? 'warning' : undefined;
  return (
    <Text role={role} tone={tone} style={baseStyle}>
      {children}
    </Text>
  );
};

const usageLine = (snapshot: MemorySnapshot) =>
  `${formatMemory(snapshot.usedBytes)}${
    snapshot.limitBytes ? ` / ${formatMemory(snapshot.limitBytes)}` : ''
  }`;

export const MemoryCard: React.FC<{ snapshots: MemorySnapshot[] }> = ({
  snapshots,
}) => {
  const { t } = useTranslation();
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <MetricCard title={t('performance.memoryUsage')}>
      {!!latest && (
        <>
          <Text role="caption" tone="secondary" style={styles.sectionSubtitle}>
            {t('performance.current')}
          </Text>
          <MetricPanel>
            <MetricRow label={t('performance.used')}>
              <ThresholdText usagePercent={latest.usagePercent}>
                {usageLine(latest)}
              </ThresholdText>
            </MetricRow>
            <MetricRow label={t('labels.usage')}>
              <ThresholdText usagePercent={latest.usagePercent}>
                {latest.usagePercent.toFixed(1)}%
              </ThresholdText>
            </MetricRow>
          </MetricPanel>
        </>
      )}

      {snapshots.length > 0 && (
        <>
          <Text
            role="caption"
            tone="secondary"
            style={styles.memoryHistorySubtitle}
          >
            {t('performance.recentHistory')}
          </Text>
          <View style={styles.memoryList}>
            {snapshots.map(snapshot => (
              <View key={snapshot.timestamp} style={styles.memoryItem}>
                <View style={styles.memoryItemHeader}>
                  <Text role="label">
                    {formatTimestamp(snapshot.timestamp)}
                  </Text>
                  <ThresholdText
                    usagePercent={snapshot.usagePercent}
                    role="heading"
                    baseStyle={styles.memoryUsage}
                  >
                    {snapshot.usagePercent.toFixed(1)}%
                  </ThresholdText>
                </View>
                <Text role="caption" tone="secondary">
                  {usageLine(snapshot)}
                  {!!snapshot.context && ` • ${snapshot.context}`}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {!latest && (
        <Text role="caption" tone="secondary" style={styles.sectionSubtitle}>
          {t('performance.waitingForSnapshot')}
        </Text>
      )}
    </MetricCard>
  );
};
