import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
  const { theme } = useUnistyles();
  const barColor = color || theme.colors.primary;

  if (!data || data.length === 0) {
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
      {/* Simple list-based bar chart as horizontal bar charts are complex in victory-native */}
      <View style={styles.barList}>
        {[...data].slice(0, 10).map((item, index) => {
          const maxValue = Math.max(...data.map(d => d.value), 1);
          const barWidth = (item.value / maxValue) * 100;
          return (
            <View key={`${item.label}-${index}`} style={styles.barItem}>
              <View style={styles.barLabelContainer}>
                <Text
                  style={[styles.barLabel, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    { width: `${barWidth}%`, backgroundColor: barColor },
                  ]}
                />
                <Text style={[styles.barValue, { color: theme.colors.textSecondary }]}>
                  {item.value}
                  {showSecondaryValue && item.secondaryValue !== undefined && (
                    <Text style={styles.secondaryValue}>
                      {` (${secondaryValuePrefix}${item.secondaryValue.toFixed(2)})`}
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    marginBottom: theme.spacing.md,
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
  barList: {
    paddingHorizontal: theme.spacing.sm,
  },
  barItem: {
    marginBottom: theme.spacing.sm,
  },
  barLabelContainer: {
    marginBottom: theme.spacing.xs,
  },
  barLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  bar: {
    height: 20,
    borderRadius: 4,
    minWidth: 4,
  },
  barValue: {
    fontSize: theme.fonts.size.xs,
    marginLeft: theme.spacing.sm,
  },
  secondaryValue: {
    fontWeight: theme.fonts.weight.regular,
  },
}));
