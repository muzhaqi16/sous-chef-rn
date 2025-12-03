import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CartesianChart, Line, Area } from 'victory-native';
import type { TimeSeriesDataPoint } from '#types';

interface TrendLineChartProps {
  data: TimeSeriesDataPoint[];
  height?: number;
  showArea?: boolean;
  color?: string;
  title?: string;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  height = 200,
  showArea = true,
  color,
  title,
}) => {
  const { theme } = useUnistyles();
  const lineColor = color || theme.colors.primary;

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((point, index) => ({
      x: index,
      y: point.value,
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
      <View style={{ height }}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['y']}
          domainPadding={{ left: 10, right: 10, top: 20, bottom: 10 }}
          axisOptions={{
            font: null,
            lineColor: theme.colors.border,
            labelColor: theme.colors.textSecondary,
          }}
        >
          {({ points }) => (
            <>
              {showArea && (
                <Area
                  points={points.y}
                  y0={height - 40}
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
