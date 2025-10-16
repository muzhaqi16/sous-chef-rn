import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { SwipeableItem } from '#components';
import { usePantryManagement, useDefaultHome, useAppNavigation } from '#hooks';
import { useGetHomeQuery } from '#generated';
import { commonStyles } from '#styles';

export const ExpiringItems: React.FC = () => {
  const { goBack, navigateTo } = useAppNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useUnistyles();

  const { selectedHomeId, getDefaultPantry } = useDefaultHome();
  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[commonStyles.title, styles.headerTitle]}>
          Expiring Items
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {loading || !items ? (
          <View style={[commonStyles.center, styles.loadingContainer]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : expiringItems.length === 0 ? (
          <View style={[commonStyles.center, styles.emptyState]}>
            <Icon name="check-circle" size={64} color={theme.colors.success} />
            <Text style={[commonStyles.body, styles.emptyText]}>
              No items expiring in the next 30 days
            </Text>
          </View>
        ) : (
          expiringItems.map(item => {
            const daysUntil = getDaysUntilExpiration(item?.expiresAt || '');
            const statusColor =
              daysUntil < 0
                ? theme.colors.error
                : daysUntil <= 7
                  ? theme.colors.warning
                  : theme.colors.success;

            return (
              <SwipeableItem
                key={item.id}
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
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    ...commonStyles.rowSpaceBetween,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 24,
  },
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
