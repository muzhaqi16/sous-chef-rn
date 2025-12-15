import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Pie, PolarChart } from 'victory-native';

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
  const { theme } = useUnistyles();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      label: item.label,
      value: item.value,
      color: colorScale[index % colorScale.length],
    }));
  }, [data, colorScale]);

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { minHeight: height }]}>
        {title && (
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
        )}
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No data available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && (
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
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
        {showLegend && (
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
                  <Text
                    style={[styles.legendText, { color: theme.colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[styles.legendPercentage, { color: theme.colors.textSecondary }]}
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
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
    fontSize: theme.fonts.size.xs,
    flex: 1,
  },
  legendPercentage: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    marginLeft: theme.spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  emptyText: {
    fontSize: theme.fonts.size.sm,
  },
}));
