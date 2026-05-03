import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import GroceryBasket from '#assets/icons/svg/grocery-basket.svg';
import { type PantryStats } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

interface PantryAlertBarProps {
  stats: Pick<PantryStats, 'totalItems' | 'expiringCount' | 'lowStockCount'>;
  onAnalyticsPress?: () => void;
  onLowStockNavigate?: () => void;
  onExpiringNavigate?: () => void;
  sortLabel?: string;
  onSortPress?: () => void;
}

export const PantryAlertBar: React.FC<PantryAlertBarProps> = ({
  stats,
  onAnalyticsPress,
  onLowStockNavigate,
  onExpiringNavigate,
  sortLabel,
  onSortPress,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      {/* Left: item count */}
      <View style={styles.statLink}>
        <GroceryBasket
          width={16}
          height={16}
          color={theme.colors.textSecondary}
        />
        <Text size="sm" weight="medium" tone="secondary">
          {stats.totalItems} {stats.totalItems === 1 ? 'item' : 'items'}
        </Text>
      </View>

      {/* Center: badges (only when present) */}
      {(stats.expiringCount > 0 || stats.lowStockCount > 0) && (
        <View style={styles.centerGroup}>
          {stats.expiringCount > 0 && (
            <Pressable
              onPress={onExpiringNavigate}
              disabled={!onExpiringNavigate}
              style={styles.statLink}
            >
              <Icon
                name="time-outline"
                size={14}
                color={theme.colors.warning}
              />
              <Text size="sm" weight="medium" tone="warning">
                {stats.expiringCount} expiring
              </Text>
            </Pressable>
          )}
          {stats.lowStockCount > 0 && (
            <Pressable
              onPress={onLowStockNavigate}
              disabled={!onLowStockNavigate}
              style={styles.statLink}
            >
              <Icon
                name="trending-down-outline"
                size={14}
                color={theme.colors.danger}
              />
              <Text
                size="sm"
                weight="medium"
                style={{ color: theme.colors.danger }}
              >
                {stats.lowStockCount} low stock
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Right: analytics + sort */}
      <View style={styles.rightGroup}>
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
        {!!sortLabel && !!onSortPress && (
          <Pressable
            onPress={onSortPress}
            hitSlop={8}
            testID="pantry-sort-button"
          >
            <Text size="sm" weight="medium" style={styles.sortLabel}>
              {sortLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  centerGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    justifyContent: 'flex-start',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sortLabel: {
    color: theme.colors.sectionHeader.actionText,
  },
}));
