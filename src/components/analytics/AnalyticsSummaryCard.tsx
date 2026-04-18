import React from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
  const { theme } = useUnistyles();
  const cardColor = color || theme.colors.primary;

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return theme.colors.success;
      case 'down':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getTrendIcon = (): IconName => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'remove-outline';
    }
  };

  return (
    <View style={[commonStyles.shadow, styles.card]}>
      <View style={styles.header}>
        {!!icon && (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: cardColor + '20' },
            ]}
          >
            <Icon
              name={icon}
              size={20}
              color={cardColor}
              library={iconLibrary}
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
            <Icon name={getTrendIcon()} size={14} color={getTrendColor()} />
            <Text size="xs" weight="medium" style={{ color: getTrendColor() }}>
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
}));
