import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StaticScreenProps } from '@react-navigation/native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { ThemedBackButton } from '#components/atoms/themedComponents';
import { commonStyles } from '#/styles/commonStyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import {
  PurchaseHistoryProvider,
  usePurchaseHistoryContext,
} from './PurchaseHistoryContext';
import { Text } from '#components/atoms/Text';

const keyExtractor = (item: { id: string }) => item.id;

type RouteParams = {
  itemId: string;
  itemName: string;
  purchases: Array<{
    id: string;
    purchaseDate: string;
    quantity: number;
    unitSymbol: string;
    user?: {
      id: string;
      email: string;
      profile?: {
        displayName?: string;
      };
    };
  }>;
};

type PurchaseItem = RouteParams['purchases'][0];

// Pure function at module scope
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// --- Module-scope FlashList components ---

type PurchaseHistoryItemProps = ListRenderItemInfo<PurchaseItem>;

const PurchaseHistoryItemComponent: React.FC<PurchaseHistoryItemProps> = ({
  item: purchase,
  index,
}) => {
  const { t } = useTranslation();
  const { totalCount } = usePurchaseHistoryContext();

  return (
    <View style={[styles.purchaseCard, commonStyles.shadow]}>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseNumber}>
          <Text size="xs" weight="bold" style={styles.purchaseNumberText}>
            #{totalCount - index}
          </Text>
        </View>
        <Text size="sm" weight="medium" style={styles.purchaseDate}>
          {formatDate(purchase.purchaseDate)}
        </Text>
      </View>

      <View style={styles.purchaseDetails}>
        <View style={styles.purchaseDetailRow}>
          <Icon name="cube-outline" size={18} tone="iconSecondary" />
          <Text size="sm" tone="secondary" style={styles.purchaseDetailLabel}>
            {t('purchaseHistory.quantityLabel')}
          </Text>
          <Text size="sm" weight="medium" style={styles.purchaseDetailValue}>
            {purchase.quantity} {purchase.unitSymbol}
          </Text>
        </View>

        {!!purchase.user && (
          <View style={styles.purchaseDetailRow}>
            <Icon name="person-outline" size={18} tone="iconSecondary" />
            <Text size="sm" tone="secondary" style={styles.purchaseDetailLabel}>
              {t('purchaseHistory.purchasedBy')}
            </Text>
            <Text size="sm" weight="medium" style={styles.purchaseDetailValue}>
              {purchase.user.profile?.displayName || purchase.user.email}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const PurchaseHistoryItem = PurchaseHistoryItemComponent;

const getPurchaseItemType = () => 'item';

const PurchaseHistoryHeader: React.FC<{ totalCount: number }> = ({
  totalCount,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.statsContainer}>
      <Text size="md">
        {t('purchaseHistory.totalPurchases')}{' '}
        <Text weight="bold" style={styles.statsValue}>
          {totalCount}
        </Text>
      </Text>
    </View>
  );
};

const PurchaseHistoryEmpty: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyContainer}>
      <Icon name="receipt-outline" size={64} tone="iconDisabled" />
      <Text size="lg" weight="semibold" style={styles.emptyText}>
        {t('purchaseHistory.emptyTitle')}
      </Text>
      <Text
        size="sm"
        tone="secondary"
        align="center"
        style={styles.emptySubtext}
      >
        {t('purchaseHistory.emptySubtitle')}
      </Text>
    </View>
  );
};

// --- Main screen component ---

export const PurchaseHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { itemName, purchases } = route.params;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedBackButton onPress={goBack} style={styles.backButton} />
        <View style={styles.headerContent}>
          <Text size="lg" weight="semibold">
            {t('purchaseHistory.title')}
          </Text>
          <Text size="sm" tone="secondary" style={styles.headerSubtitle}>
            {itemName}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Purchase List */}
      <PurchaseHistoryProvider value={{ totalCount: purchases.length }}>
        <FlashList
          data={purchases}
          keyExtractor={keyExtractor}
          renderItem={(info: ListRenderItemInfo<PurchaseItem>) => (
            <PurchaseHistoryItem {...info} />
          )}
          getItemType={getPurchaseItemType}
          {...FLASHLIST_DEFAULTS.fullScreen}
          ListHeaderComponent={
            purchases.length > 0 ? (
              <PurchaseHistoryHeader totalCount={purchases.length} />
            ) : null
          }
          ListEmptyComponent={PurchaseHistoryEmpty}
          contentContainerStyle={styles.content}
          style={styles.scrollView}
        />
      </PurchaseHistoryProvider>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerContent: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  headerSubtitle: {
    marginTop: 2,
  },
  headerSpacer: {
    width: 40, // Balance the back button
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  statsContainer: {
    backgroundColor: theme.colors.infoLight,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  statsValue: {
    color: theme.colors.info,
  },
  purchaseCard: {
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    marginVertical: theme.spacing.sm,
    borderColor: theme.colors.border,
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  purchaseNumber: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.sm,
  },
  purchaseNumberText: {
    color: theme.colors.white,
  },
  purchaseDate: {
    flex: 1,
  },
  purchaseDetails: {
    gap: theme.spacing.xs,
  },
  purchaseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  purchaseDetailLabel: {
    marginLeft: theme.spacing.xs,
    marginRight: theme.spacing.xs,
  },
  purchaseDetailValue: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
