import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Pie, PolarChart } from 'victory-native';
import { Text } from '#components/atoms/Text';
import { EmptyState } from '#components/molecules/EmptyState';

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
}

// `primary` leads so a rebrand reaches the chart; the rest is the theme's own
// categorical ramp, which has a set per appearance.
const brandFirstColors = (theme: {
  colors: { primary: string; chartCategorical: string[] };
}) => [theme.colors.primary, ...theme.colors.chartCategorical];

export const BreakdownPieChart: React.FC<BreakdownPieChartProps> = ({
  data,
  height = 220,
  title,
  showLegend = true,
}) => {
  const { t } = useTranslation();
  // `useUnistyles()` for theme colors is the documented exception for charts —
  // the values are consumed as data by the charting library, not as styles, so
  // there is no ShadowTree path for them (cf. TrendLineChart).
  const { theme } = useUnistyles();
  const colors = brandFirstColors(theme);
  const chartData = (() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      label: item.label,
      value: item.value,
      color: colors[index % colors.length],
    }));
  })();

  if (chartData.length === 0) {
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
      <View style={styles.chartWrapper}>
        <View style={[styles.pie, { width: height, height }]}>
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
                    { backgroundColor: colors[index % colors.length] },
                  ]}
                />
                <View style={styles.legendTextContainer}>
                  <Text
                    role="caption"
                    style={styles.legendText}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <Text
                    role="label"
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
  // Square; the side comes from the `height` prop, so only the gap is a token.
  pie: {
    marginRight: theme.spacing.md,
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
}));

/** Internals under test — see the palette suite in this file's tests. */
export const __testables = { brandFirstColors };
