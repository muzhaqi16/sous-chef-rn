import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedIcon } from '#components/atoms/themedComponents';
import { Icon, IconName, IconLibrary } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

interface AnalyticsSummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: IconName;
  iconLibrary?: IconLibrary;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const trendIconName = (trend?: 'up' | 'down' | 'neutral'): IconName => {
  switch (trend) {
    case 'up':
      return 'trending-up';
    case 'down':
      return 'trending-down';
    default:
      return 'remove-outline';
  }
};

export const AnalyticsSummaryCard: React.FC<AnalyticsSummaryCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconLibrary = 'Ionicons',
  color,
  trend,
  trendValue,
}) => {
  styles.useVariants({ trend });

  return (
    <View style={[commonStyles.shadow, styles.card]}>
      <View style={styles.header}>
        {!!icon && (
          <View
            style={[
              styles.iconContainer,
              !!color && { backgroundColor: color + '20' },
            ]}
          >
            <ThemedIcon
              name={icon}
              size={20}
              library={iconLibrary}
              uniProps={t => ({ color: color ?? t.colors.primary })}
            />
          </View>
        )}
        <Text
          size="xs"
          weight="medium"
          tone="secondary"
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <Text size="2xl" weight="bold">
        {value}
      </Text>
      <View style={styles.footer}>
        {!!subtitle && (
          <Text size="xs" tone="secondary">
            {subtitle}
          </Text>
        )}
        {!!trend && !!trendValue && (
          <View style={styles.trendContainer}>
            <Icon
              name={trendIconName(trend)}
              size={14}
              tone={
                trend === 'up'
                  ? 'success'
                  : trend === 'down'
                  ? 'error'
                  : 'textSecondary'
              }
            />
            <Text size="xs" weight="medium" style={styles.trendText}>
              {trendValue}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    minWidth: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.primary + '20',
  },
  title: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    variants: {
      trend: {
        up: { color: theme.colors.success },
        down: { color: theme.colors.error },
        neutral: { color: theme.colors.textSecondary },
      },
    },
  },
}));
