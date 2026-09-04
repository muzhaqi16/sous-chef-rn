import React from 'react';
import { useTranslation } from '#/i18n';
import { View, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CartesianChart, Line, Area } from 'victory-native';
import { matchFont, Circle } from '@shopify/react-native-skia';
import { type TimeSeriesDataPoint } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { typography } from '#/theme/foundations/typography';
import { motion } from '#/theme/foundations/motion';
import { EmptyState } from '#components/molecules/EmptyState';

// `useUnistyles()` is intentional here: theme colors feed Skia primitives
// (Line, Area, Circle) and victory-native's yAxis/frame config — runtime
// values consumed inside Skia's draw context, which can't move into a
// StyleSheet.create. See `SpotlightCoachMark.tsx` for the same precedent.

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
const axisFont = matchFont({
  fontFamily,
  fontSize: typography.fontSize['3xs'],
});

interface TrendLineChartProps {
  data: TimeSeriesDataPoint[];
  height?: number;
  showArea?: boolean;
  color?: string;
  title?: string;
  subtitle?: string;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  height = 200,
  showArea = true,
  color,
  title,
  subtitle,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lineColor = color || theme.colors.primary;

  const chartData = (() => {
    if (!data || data.length === 0) return [];
    return data.map((point, index) => ({
      x: index,
      y: point.count,
    }));
  })();

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
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
      {!!subtitle && (
        <Text role="caption" tone="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      <View style={{ height }}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['y']}
          domainPadding={{ left: 10, right: 10, top: 20, bottom: 10 }}
          yAxis={[
            {
              font: axisFont,
              tickCount: 5,
              labelColor: theme.colors.textSecondary,
              lineColor: theme.colors.border,
            },
          ]}
          frame={{
            lineColor: theme.colors.border,
            lineWidth: 1,
          }}
        >
          {({ points, chartBounds }) => (
            <>
              {!!showArea && (
                <Area
                  points={points.y}
                  y0={chartBounds.bottom}
                  color={lineColor}
                  opacity={0.15}
                  animate={{ type: 'timing', duration: motion.timing.SLOW }}
                />
              )}
              <Line
                points={points.y}
                color={lineColor}
                strokeWidth={2}
                animate={{ type: 'timing', duration: motion.timing.SLOW }}
              />
              {chartData.length === 1 &&
                !!points.y[0] &&
                points.y[0].y != null && (
                  <Circle
                    cx={points.y[0].x}
                    cy={points.y[0].y}
                    r={4}
                    color={lineColor}
                  />
                )}
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginVertical: theme.spacing.sm,
  },
  title: {
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  subtitle: {
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
}));
