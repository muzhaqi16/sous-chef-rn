import React, { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CartesianChart, Line, Area } from 'victory-native';
import { matchFont, Circle } from '@shopify/react-native-skia';
import type { TimeSeriesDataPoint } from '#generated';

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
const axisFont = matchFont({ fontFamily, fontSize: 10 });

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
  const { theme } = useUnistyles();
  const lineColor = color || theme.colors.primary;

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((point, index) => ({
      x: index,
      y: point.count,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
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
      {subtitle && (
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
      <View style={{ height }}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['y']}
          domainPadding={{ left: 10, right: 10, top: 20, bottom: 10 }}
          yAxis={[{
            font: axisFont,
            tickCount: 5,
            labelColor: theme.colors.textSecondary,
            lineColor: theme.colors.border,
          }]}
          frame={{
            lineColor: theme.colors.border,
            lineWidth: 1,
          }}
        >
          {({ points, chartBounds }) => (
            <>
              {showArea && (
                <Area
                  points={points.y}
                  y0={chartBounds.bottom}
                  color={lineColor}
                  opacity={0.15}
                  animate={{ type: 'timing', duration: 300 }}
                />
              )}
              <Line
                points={points.y}
                color={lineColor}
                strokeWidth={2}
                animate={{ type: 'timing', duration: 300 }}
              />
              {chartData.length === 1 && points.y[0] && points.y[0].y != null && (
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fonts.size.xs,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
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
