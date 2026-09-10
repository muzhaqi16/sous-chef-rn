import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { EmptyState } from '#components/molecules/EmptyState';

interface DataItem {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface TopItemsBarChartProps {
  data: DataItem[];
  height?: number;
  title?: string;
  color?: string;
  valueLabel?: string;
  showSecondaryValue?: boolean;
  secondaryValuePrefix?: string;
}

export const TopItemsBarChart: React.FC<TopItemsBarChartProps> = ({
  data,
  height = 250,
  title,
  color,
  showSecondaryValue = false,
  secondaryValuePrefix = '$',
}) => {
  const { t } = useTranslation();
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { minHeight: height }]}>
        {!!title && (
          <Text role="bodyStrong" style={styles.title}>
            {title}
          </Text>
        )}
        <EmptyState size="compact" title={t('labels.noDataAvailable')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!!title && (
        <Text role="bodyStrong" style={styles.title}>
          {title}
        </Text>
      )}
      {/* Simple list-based bar chart as horizontal bar charts are complex in victory-native */}
      <View style={styles.barList}>
        {[...data].slice(0, 10).map((item, index) => {
          const maxValue = Math.max(...data.map(d => d.value), 1);
          const barWidth = (item.value / maxValue) * 100;
          return (
            <View key={`${item.label}-${index}`} style={styles.barItem}>
              <View style={styles.barLabelContainer}>
                <Text role="label" numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
              <View style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${barWidth}%` },
                      !!color && { backgroundColor: color },
                    ]}
                  />
                </View>
                <Text role="caption" tone="secondary" style={styles.barValue}>
                  {item.value}
                  {!!showSecondaryValue &&
                    item.secondaryValue !== undefined && (
                      <Text role="body">
                        {` (${secondaryValuePrefix}${item.secondaryValue.toFixed(
                          2,
                        )})`}
                      </Text>
                    )}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginVertical: theme.spacing.sm,
  },
  title: {
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  barList: {
    paddingHorizontal: theme.spacing.sm,
  },
  barItem: {
    marginBottom: theme.spacing.sm,
  },
  barLabelContainer: {
    marginBottom: theme.spacing.xs,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  barWrapper: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  bar: {
    height: 20,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    minWidth: 4,
    backgroundColor: theme.colors.primary,
  },
  barValue: {
    flexShrink: 0,
  },
}));
