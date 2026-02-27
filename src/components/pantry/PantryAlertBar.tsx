import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Badge } from '#components/base/Badge';
import type { PantryStats } from '#generated';

interface PantryAlertBarProps {
  stats: Pick<PantryStats, 'totalItems' | 'expiringCount' | 'lowStockCount'>;
  onAnalyticsPress?: () => void;
  onLowStockNavigate?: () => void;
}

export const PantryAlertBar: React.FC<PantryAlertBarProps> = ({
  stats,
  onAnalyticsPress,
  onLowStockNavigate,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Icon name="cube-outline" size={16} color={theme.colors.textSecondary} />
      <Text style={styles.itemCount}>
        {stats.totalItems} {stats.totalItems === 1 ? 'item' : 'items'}
      </Text>

      <View style={styles.badges}>
        {stats.expiringCount > 0 && (
          <Badge variant="warning" size="small">
            {stats.expiringCount} expiring
          </Badge>
        )}
        {stats.lowStockCount > 0 && (
          <Pressable onPress={onLowStockNavigate} disabled={!onLowStockNavigate}>
            <Badge variant="danger" size="small">
              {stats.lowStockCount} low stock
            </Badge>
          </Pressable>
        )}
      </View>

      {!!onAnalyticsPress && (
        <Pressable
          onPress={onAnalyticsPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View analytics"
        >
          <Icon
            name="bar-chart-outline"
            size={18}
            color={theme.colors.textTertiary}
          />
        </Pressable>
      )}

    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  itemCount: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  badges: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
}));
