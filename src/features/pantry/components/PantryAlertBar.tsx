import React from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import GroceryBasket from '#assets/icons/svg/grocery-basket.svg';
import { type PantryStats } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

const ThemedGroceryBasket = withUnistyles(GroceryBasket, theme => ({
  color: theme.colors.textSecondary,
}));

interface PantryAlertBarProps {
  stats: Pick<
    PantryStats,
    'totalItems' | 'expiringCount' | 'expiredCount' | 'lowStockCount'
  >;
  onAnalyticsPress?: () => void;
  onLowStockNavigate?: () => void;
  onExpiringNavigate?: () => void;
  onExpiredNavigate?: () => void;
  sortLabel?: string;
  onSortPress?: () => void;
}

export const PantryAlertBar: React.FC<PantryAlertBarProps> = ({
  stats,
  onAnalyticsPress,
  onLowStockNavigate,
  onExpiringNavigate,
  onExpiredNavigate,
  sortLabel,
  onSortPress,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Status cluster: item count + compact alert pills (icon + count).
          Scrolls horizontally if it ever outgrows the row, so it never
          collides with the controls or clips — and stays on one line, keeping
          the list's vertical space. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusScroll}
        contentContainerStyle={styles.statusContent}
      >
        <View style={styles.statLink}>
          <ThemedGroceryBasket width={16} height={16} />
          <Text role="label" tone="secondary">
            {t('pantryScreen.itemCount', { count: stats.totalItems })}
          </Text>
        </View>

        {stats.expiredCount > 0 && (
          <AppPressable
            onPress={onExpiredNavigate}
            disabled={!onExpiredNavigate}
            style={styles.statLink}
            accessibilityRole="button"
            accessibilityLabel={t('pantryScreen.expiredCount', {
              count: stats.expiredCount,
            })}
          >
            <Icon name="alert-circle-outline" size={14} tone="expired" />
            <Text role="label" style={styles.expiredText}>
              {stats.expiredCount}
            </Text>
          </AppPressable>
        )}
        {stats.expiringCount > 0 && (
          <AppPressable
            onPress={onExpiringNavigate}
            disabled={!onExpiringNavigate}
            style={styles.statLink}
            accessibilityRole="button"
            accessibilityLabel={t('pantryScreen.expiringCount', {
              count: stats.expiringCount,
            })}
          >
            <Icon name="time-outline" size={14} tone="warning" />
            <Text role="label" tone="warning">
              {stats.expiringCount}
            </Text>
          </AppPressable>
        )}
        {stats.lowStockCount > 0 && (
          <AppPressable
            onPress={onLowStockNavigate}
            disabled={!onLowStockNavigate}
            style={styles.statLink}
            accessibilityRole="button"
            accessibilityLabel={t('pantryScreen.lowStockCount', {
              count: stats.lowStockCount,
            })}
          >
            <Icon name="trending-down-outline" size={14} tone="warning" />
            <Text role="label" tone="warning">
              {stats.lowStockCount}
            </Text>
          </AppPressable>
        )}
      </ScrollView>

      {/* Controls: analytics + sort — fixed, pinned to the right */}
      <View style={styles.rightGroup}>
        {!!onAnalyticsPress && (
          <AppPressable
            onPress={onAnalyticsPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('pantryScreen.analyticsAccessibility')}
          >
            <Icon name="bar-chart-outline" size={18} tone="textTertiary" />
          </AppPressable>
        )}
        {!!sortLabel && !!onSortPress && (
          <AppPressable
            onPress={onSortPress}
            hitSlop={8}
            testID="pantry-sort-button"
          >
            <Text role="label" style={styles.sortLabel}>
              {sortLabel}
            </Text>
          </AppPressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  statusScroll: {
    // Take the row's remaining width so the controls stay pinned right; the
    // cluster scrolls within this box only when its content overflows.
    flex: 1,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
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
  expiredText: {
    color: theme.colors.expiration.expiredText,
  },
}));
