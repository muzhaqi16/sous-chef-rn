import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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

/**
 * Categorical slice colors, brand-first.
 *
 * ONE color comes from the theme, so a rebrand reaches the chart — the literal
 * hexes this replaced (`'#FF8C42' // Primary orange`) meant a fork could change
 * `appConfig.branding.primaryColor` and still get the old orange. The rest are a
 * fixed categorical set: they exist to be DISTINGUISHABLE from the brand and
 * from each other, so deriving them from one hue would defeat the point.
 *
 * Slots 2 and 3 used to be `primaryDark` and `primaryLight`, and both were
 * wrong for a data color:
 *
 *   - `primaryLight` is `brand[400] + '20'` in the dark theme — an 8-digit hex
 *     whose alpha byte is 12.5%, described in `themes.ts` as an "accent
 *     surface". Fed to a Skia slice fill and a legend chip's `backgroundColor`,
 *     the third category simply vanished from both, dark mode only.
 *   - `primary` and `primaryDark` are adjacent steps of one ramp
 *     (brand[500]/brand[600] in dark), which is not the separation a
 *     categorical scale needs.
 *
 * A data color must be opaque and separated in BOTH themes. Anything defined as
 * a translucent surface tint is not a candidate.
 */
const brandFirstColors = (theme: { colors: { primary: string } }) => [
  theme.colors.primary,
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#F4A261',
  '#8E7DBE',
];

export const BreakdownPieChart: React.FC<BreakdownPieChartProps> = ({
  data,
  height = 220,
  title,
  showLegend = true,
  colorScale,
}) => {
  const { t } = useTranslation();
  // `useUnistyles()` for theme colors is the documented exception for charts —
  // the values are consumed as data by the charting library, not as styles, so
  // there is no ShadowTree path for them (cf. TrendLineChart).
  const { theme } = useUnistyles();
  const colors = colorScale ?? brandFirstColors(theme);
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
                    { backgroundColor: colors[index % colors.length] },
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

/** Internals under test — see the palette suite in this file's tests. */
export const __testables = { brandFirstColors };
