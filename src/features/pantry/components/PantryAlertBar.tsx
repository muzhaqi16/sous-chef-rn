import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import type { PantryStats } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

interface PantryAlertBarProps {
  stats: Pick<PantryStats, 'expiringCount' | 'expiredCount' | 'lowStockCount'>;
  onLowStockNavigate?: () => void;
  onExpiringNavigate?: () => void;
  onExpiredNavigate?: () => void;
}

/**
 * The pantry's status counts, each opening the list of items in that status.
 * Nothing else sits here: the total is on the "All" chip, sort is beside
 * search, and analytics is in the Select pantry sheet.
 */
export const PantryAlertBar: React.FC<PantryAlertBarProps> = ({
  stats,
  onLowStockNavigate,
  onExpiringNavigate,
  onExpiredNavigate,
}) => {
  const { t } = useTranslation();

  if (
    stats.expiredCount <= 0 &&
    stats.expiringCount <= 0 &&
    stats.lowStockCount <= 0
  ) {
    return null;
  }

  // Scrolls sideways if it ever outgrows the row, so it stays on one line.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.statusContent}
    >
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
          <Icon name="time-outline" size={14} tone="expiring" />
          <Text role="label" style={styles.expiringText}>
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
          <Icon name="trending-down-outline" size={14} tone="info" />
          <Text role="label" tone="info">
            {stats.lowStockCount}
          </Text>
        </AppPressable>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexGrow: 0,
    paddingVertical: theme.spacing.sm,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['2xsPlus'],
  },
  expiredText: {
    color: theme.colors.expiration.expiredText,
  },
  // The same token the row's expiry text uses, so a chip and the rows it
  // counts cannot read as different states.
  expiringText: {
    color: theme.colors.expiration.warningText,
  },
}));
