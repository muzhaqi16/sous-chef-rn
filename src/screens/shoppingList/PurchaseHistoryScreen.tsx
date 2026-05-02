import React from 'react';
import { View, Text } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { BackButton } from '#components/atoms/BackButton';
import { commonStyles } from '#/styles/commonStyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import {
  PurchaseHistoryProvider,
  usePurchaseHistoryContext,
} from './PurchaseHistoryContext';

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

type PurchaseHistoryItemProps = ListRenderItemInfo<PurchaseItem> & {
  iconSecondaryColor: string;
};

const PurchaseHistoryItemComponent: React.FC<PurchaseHistoryItemProps> = ({
  item: purchase,
  index,
  iconSecondaryColor,
}) => {
  const { totalCount } = usePurchaseHistoryContext();

  return (
    <View style={styles.purchaseCard}>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseNumber}>
          <Text style={styles.purchaseNumberText}>#{totalCount - index}</Text>
        </View>
        <Text style={styles.purchaseDate}>
          {formatDate(purchase.purchaseDate)}
        </Text>
      </View>

      <View style={styles.purchaseDetails}>
        <View style={styles.purchaseDetailRow}>
          <Icon name="cube-outline" size={18} color={iconSecondaryColor} />
          <Text style={styles.purchaseDetailLabel}>Quantity:</Text>
          <Text style={styles.purchaseDetailValue}>
            {purchase.quantity} {purchase.unitSymbol}
          </Text>
        </View>

        {!!purchase.user && (
          <View style={styles.purchaseDetailRow}>
            <Icon name="person-outline" size={18} color={iconSecondaryColor} />
            <Text style={styles.purchaseDetailLabel}>Purchased by:</Text>
            <Text style={styles.purchaseDetailValue}>
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
}) => (
  <View style={styles.statsContainer}>
    <Text style={styles.statsText}>
      Total Purchases: <Text style={styles.statsValue}>{totalCount}</Text>
    </Text>
  </View>
);

const PurchaseHistoryEmpty: React.FC = () => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.emptyContainer}>
      <Icon
        name="receipt-outline"
        size={64}
        color={theme.colors.iconDisabled}
      />
      <Text style={styles.emptyText}>No purchase history</Text>
      <Text style={styles.emptySubtext}>
        Mark this item as purchased to start tracking history
      </Text>
    </View>
  );
};

// --- Main screen component ---

export const PurchaseHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const { itemName, purchases } = route.params;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton
          onPress={goBack}
          color={theme.colors.textPrimary}
          style={styles.backButton}
        />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Purchase History</Text>
          <Text style={styles.headerSubtitle}>{itemName}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Purchase List */}
      <PurchaseHistoryProvider value={{ totalCount: purchases.length }}>
        <FlashList
          data={purchases}
          keyExtractor={keyExtractor}
          renderItem={(info: ListRenderItemInfo<PurchaseItem>) => (
            <PurchaseHistoryItem
              {...info}
              iconSecondaryColor={theme.colors.iconSecondary}
            />
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
  headerTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
  statsText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
  },
  statsValue: {
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.info,
  },
  purchaseCard: {
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    marginVertical: theme.spacing.sm,
    borderColor: theme.colors.border,
    ...commonStyles.shadow,
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
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.sm,
  },
  purchaseNumberText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.bold,
  },
  purchaseDate: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
    marginRight: theme.spacing.xs,
  },
  purchaseDetailValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
