import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation} from '@react-navigation/native';
import {StyleSheet} from 'react-native-unistyles';
import {SwipeableItem} from '#components';
import {usePantryItems, useDefaultHome} from '#hooks';
import {useGetHomeQuery} from '#generated';
import {ExpiringItemsNavProp} from '#/navigation';

export const ExpiringItems: React.FC = () => {
  const navigation = useNavigation<ExpiringItemsNavProp>();
  const [refreshing, setRefreshing] = React.useState(false);

  const {selectedHomeId, getDefaultPantryId} = useDefaultHome();
  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    skip: !selectedHomeId,
  });

  const pantryId = getDefaultPantryId(homeData);
  const {items, refetch} = usePantryItems(pantryId);

  const expiringItems = useMemo(() => {
    if (!items) return [];

    const now = new Date();
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Expiring Items</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {expiringItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check-circle" size={64} color={theme.colors.success} />
            <Text style={styles.emptyText}>
              No items expiring in the next 30 days
            </Text>
          </View>
        ) : (
          expiringItems.map(item => {
            const daysUntil = getDaysUntilExpiration(item?.expiresAt || '');

            return (
              <SwipeableItem
                key={item.id}
                onPress={() =>
                  navigation.navigate('PantryItemDetail', {itemId: item.id})
                }>
                <View style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.item?.name}</Text>
                    <Text style={styles.itemDetails}>
                      {item.currentQuantity} {item.unit?.symbol} •{' '}
                      {item.storageState}
                    </Text>
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            daysUntil < 0
                              ? '#FF0000'
                              : daysUntil <= 7
                                ? '#FFB84D'
                                : '#4CAF50',
                        },
                      ]}>
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    marginLeft: 16,
    position: 'relative',
  },
  placeholder: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  itemDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
}));
