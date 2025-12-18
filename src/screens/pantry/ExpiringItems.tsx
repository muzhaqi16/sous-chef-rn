import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { SwipeableItem } from '#components';
import { Header } from '#components/molecules/Header';
import { PantryItemSkeleton } from '#components/base/Skeleton';
import { usePantryManagement, useAppNavigation } from '#hooks';
import { useGetHomeQuery } from '#generated';
import { commonStyles } from '#styles';
import { useAppStore, selectSelectedHomeId } from '#store/useAppStore';
import { normalizeHome } from '#/utils/connectionUtils';

export const ExpiringItems: React.FC = () => {
  const { goBack, navigateTo } = useAppNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useUnistyles();

  // Get selectedHomeId from Zustand (no GraphQL query triggered)
  const selectedHomeId = useAppStore(selectSelectedHomeId);

  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  // Helper to get default pantry (inline to avoid useDefaultHome dependency)
  const getDefaultPantry = useCallback((data: any) => {
    const normalized = normalizeHome(data?.home ?? data);
    if (!normalized?.pantries?.length) return null;
    return normalized.pantries.find((p: any) => p.isDefault) || normalized.pantries[0] || null;
  }, []);

  const pantry = getDefaultPantry(homeData);
  const { items, loading, refetch } = usePantryManagement(pantry?.id);

  const expiringItems = useMemo(() => {
    if (!items) return [];

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return items
      .filter(item => {
        if (!item.expiresAt) return false;
        const expirationDate = new Date(item.expiresAt);
        return expirationDate <= thirtyDaysFromNow;
      })
      .sort((a, b) => {
        const dateA = new Date(a?.expiresAt || 0);
        const dateB = new Date(b?.expiresAt || 0);
        return dateA.getTime() - dateB.getTime();
      });
  }, [items]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getDaysUntilExpiration = (expirationDate: string) => {
    const now = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <View style={commonStyles.container}>
      <Header
        title="Expiring Items"
        centerTitle
        onBack={goBack}
      />

      <FlatList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        data={expiringItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          loading || !items ? (
            <View style={styles.skeletonContainer}>
              {[1, 2, 3, 4, 5].map(key => (
                <PantryItemSkeleton key={key} />
              ))}
            </View>
          ) : (
            <View style={[commonStyles.center, styles.emptyState]}>
              <Icon name="check-circle" size={64} color={theme.colors.success} />
              <Text style={[commonStyles.body, styles.emptyText]}>
                No items expiring in the next 30 days
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const daysUntil = getDaysUntilExpiration(item?.expiresAt || '');
          const statusColor =
            daysUntil < 0
              ? theme.colors.error
              : daysUntil <= 7
                ? theme.colors.warning
                : theme.colors.success;

          return (
            <SwipeableItem
              onPress={() =>
                navigateTo.pantryItemDetail({
                  itemId: item.id,
                })
              }
            >
              <View style={[commonStyles.card, styles.itemCard]}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.item?.name}</Text>
                  <Text style={[commonStyles.caption, styles.itemDetails]}>
                    {item.currentQuantity} {item.unit?.symbol} •{' '}
                    {item.storageState}
                  </Text>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {daysUntil < 0
                      ? `Expired ${Math.abs(daysUntil)} days ago`
                      : daysUntil === 0
                        ? 'Expires today'
                        : `Expires in ${daysUntil} days`}
                  </Text>
                </View>
              </View>
            </SwipeableItem>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  emptyState: {
    padding: theme.spacing['2xl'],
  },
  emptyText: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: theme.spacing['2xl'],
  },
  skeletonContainer: {
    gap: theme.spacing.sm,
  },
  itemCard: {
    marginBottom: theme.spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  itemDetails: {
    marginTop: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    marginTop: theme.spacing.xs,
  },
}));
