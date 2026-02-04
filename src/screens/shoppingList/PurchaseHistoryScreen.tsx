import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ListRenderItem } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';

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

export const PurchaseHistoryScreen: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const { itemName, purchases } = route.params;

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const renderPurchaseItem: ListRenderItem<RouteParams['purchases'][0]> = useCallback(
    ({ item: purchase, index }) => (
      <View key={purchase.id} style={styles.purchaseCard}>
        <View style={styles.purchaseHeader}>
          <View style={styles.purchaseNumber}>
            <Text style={styles.purchaseNumberText}>
              #{purchases.length - index}
            </Text>
          </View>
          <Text style={styles.purchaseDate}>
            {formatDate(purchase.purchaseDate)}
          </Text>
        </View>

        <View style={styles.purchaseDetails}>
          <View style={styles.purchaseDetailRow}>
            <Icon
              name="cube-outline"
              size={18}
              library="Ionicons"
              color={theme.colors.iconSecondary}
            />
            <Text style={styles.purchaseDetailLabel}>Quantity:</Text>
            <Text style={styles.purchaseDetailValue}>
              {purchase.quantity} {purchase.unitSymbol}
            </Text>
          </View>

          {purchase.user && (
            <View style={styles.purchaseDetailRow}>
              <Icon
                name="person-outline"
                size={18}
                color={theme.colors.iconSecondary}
              />
              <Text style={styles.purchaseDetailLabel}>
                Purchased by:
              </Text>
              <Text style={styles.purchaseDetailValue}>
                {purchase.user.profile?.displayName ||
                  purchase.user.email}
              </Text>
            </View>
          )}
        </View>
      </View>
    ),
    [purchases.length, formatDate, theme.colors.iconSecondary],
  );

  // PERFORMANCE: Memoize render functions to avoid recreation on every render
  const renderListHeader = useCallback(
    () => (
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Total Purchases:{' '}
          <Text style={styles.statsValue}>{purchases.length}</Text>
        </Text>
      </View>
    ),
    [purchases.length],
  );

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Icon
          name="receipt-outline"
          size={64}
          color={theme.colors.iconDisabled}
          library="Ionicons"
        />
        <Text style={styles.emptyText}>No purchase history</Text>
        <Text style={styles.emptySubtext}>
          Mark this item as purchased to start tracking history
        </Text>
      </View>
    ),
    [theme.colors.iconDisabled],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Purchase History</Text>
          <Text style={styles.headerSubtitle}>{itemName}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Purchase List */}
      <FlatList
        data={purchases}
        keyExtractor={item => item.id}
        renderItem={renderPurchaseItem}
        ListHeaderComponent={purchases.length > 0 ? renderListHeader : null}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={styles.content}
        style={styles.scrollView}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={5}
      />
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
}));
