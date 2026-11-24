import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslateFn } from '#/i18n';
import { DetailTitleRow } from '#components/atoms/DetailTitleRow';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { DetailSection } from '#components/molecules/DetailSection';
import { daysUntilExpiry, isExpiryEstimate } from '#domain/expiry';
import {
  formatDaysInPantry,
  formatStorageState,
  getDaysInPantry,
  getExpiryInfo,
} from '#features/pantry/hooks/usePantryItemTransformation';
import type { PantryItemDetailItem } from '#features/pantry/screens/usePantryItemDetailData';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { useToday } from '#hooks/app/useToday';

/**
 * The summary's expiry, on one line like its neighbours: the header names the
 * state, so the value is only when. A shelf-life guess is marked "≈", quietly.
 */
function expiryColumnOf(
  expiresOn: string | null | undefined,
  today: string,
  estimated: boolean,
  t: TranslateFn,
): { header: string; value: string } {
  if (!expiresOn) {
    return {
      header: t('pantryItemDetail.expiring'),
      value: t('pantryItemDetail.noExpiry'),
    };
  }
  const days = daysUntilExpiry(expiresOn, today);
  const when =
    days < 0
      ? t('pantryItemDetail.expiryDaysAgo', { count: -days })
      : days === 0
      ? t('labels.today')
      : days === 1
      ? t('labels.tomorrow')
      : t('labels.durationDays', { count: days });
  return {
    header: t(days < 0 ? 'labels.expired' : 'pantryItemDetail.expiring'),
    value: estimated ? t('pantryItemDetail.expiryApprox', { when }) : when,
  };
}

interface PantryItemQuantitySectionProps {
  item: PantryItemDetailItem;
  quantityText: string;
}

/** The item's name and amount, where it is kept, and how long it has left. */
export const PantryItemQuantitySection: React.FC<
  PantryItemQuantitySectionProps
> = ({ item, quantityText }) => {
  const { t } = useTranslation();
  const today = useToday();
  const expiryInfo = getExpiryInfo(item.expiresOn, today, t);
  const expiry = expiryColumnOf(
    item.expiresOn,
    today,
    isExpiryEstimate(item.expiryKind),
    t,
  );
  const storageState = formatStorageState(item.storageState, t);
  const categoryName = item.item.categories[0]?.category.name ?? null;

  return (
    <>
      <DetailTitleRow
        title={item.itemName}
        numberOfLines={2}
        trailing={
          <Text
            role="heading"
            style={styles.quantityBadge}
            testID={pantryTestIDs.detailAmount}
          >
            {quantityText}
          </Text>
        }
      />

      {(!!categoryName || !!storageState) && (
        <View style={styles.categoryBadge}>
          <Icon name="restaurant-outline" size="xs" tone="primary" />
          <Text role="label" style={styles.categoryText}>
            {categoryName ?? t('labels.item')}
            {storageState
              ? t('pantryItemDetail.inLocation', { location: storageState })
              : ''}
          </Text>
        </View>
      )}

      <DetailSection>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text role="caption" style={styles.columnLabel}>
              {t('pantryItemDetail.inThePantry')}
            </Text>
            <Text role="label" style={styles.columnValue}>
              {formatDaysInPantry(getDaysInPantry(item.createdAt), t)}
            </Text>
          </View>
          <View style={styles.column}>
            <Text role="caption" style={styles.columnLabel}>
              {expiry.header}
            </Text>
            <Text
              role="label"
              tone={
                expiryInfo?.isExpired
                  ? 'danger'
                  : expiryInfo?.isUrgent
                  ? 'warning'
                  : 'primary'
              }
              align="center"
            >
              {expiry.value}
            </Text>
          </View>
          <View style={styles.column}>
            <Text role="caption" style={styles.columnLabel}>
              {t('pantryItemDetail.amount')}
            </Text>
            <Text role="label" style={styles.columnValue}>
              {quantityText}
            </Text>
          </View>
        </View>
      </DetailSection>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  quantityBadge: {
    color: theme.colors.textSecondary,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  categoryText: {
    color: theme.colors.primaryText,
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    alignItems: 'center',
    flex: 1,
  },
  columnLabel: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  columnValue: {
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
}));
