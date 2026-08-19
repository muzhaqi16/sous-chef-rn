import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pie, PolarChart } from 'victory-native';
import { Text } from '#components/atoms/Text';

interface DataItem {
  label: string;
  value: number;
  percentage: number;
}

interface BreakdownPieChartProps {
  data: DataItem[];
  height?: number;
  title?: string;
  showLegend?: boolean;
  colorScale?: string[];
}

const DEFAULT_COLORS = [
  '#FF8C42', // Primary orange
  '#FFB347',
  '#FFD699',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
];

export const BreakdownPieChart: React.FC<BreakdownPieChartProps> = ({
  data,
  height = 220,
  title,
  showLegend = true,
  colorScale = DEFAULT_COLORS,
}) => {
  const { t } = useTranslation();
  const chartData = (() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      label: item.label,
      value: item.value,
      color: colorScale[index % colorScale.length],
    }));
  })();

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { minHeight: height }]}>
        {!!title && (
          <Text size="md" weight="semibold" style={styles.title}>
            {title}
          </Text>
        )}
        <View style={styles.emptyState}>
          <Text size="sm" tone="secondary">
            {t('labels.noDataAvailable')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!!title && (
        <Text size="md" weight="semibold" style={styles.title}>
          {title}
        </Text>
      )}
      <View style={styles.chartWrapper}>
        <View style={{ width: height, height, marginRight: 16 }}>
          <PolarChart
            data={chartData}
            labelKey="label"
            valueKey="value"
            colorKey="color"
          >
            <Pie.Chart innerRadius="50%" />
          </PolarChart>
        </View>
        {!!showLegend && (
          <View style={styles.legend}>
            {data.map((item, index) => (
              <View key={item.label} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: colorScale[index % colorScale.length] },
                  ]}
                />
                <View style={styles.legendTextContainer}>
                  <Text size="xs" style={styles.legendText} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text
                    size="xs"
                    weight="medium"
                    tone="secondary"
                    style={styles.legendPercentage}
                  >
                    {item.percentage.toFixed(0)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginVertical: theme.spacing.sm,
  },
  title: {
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legend: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: theme.radii.full,
    marginRight: theme.spacing.sm,
  },
  legendTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendText: {
    flex: 1,
  },
  legendPercentage: {
    marginLeft: theme.spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
}));
