import React, {useState} from 'react';
import {ScrollView, RefreshControl, View, Text} from 'react-native';
import {SwipeablePantryItem} from '../components/organisms/SwipeablePantryItem';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import SearchBar from '../components/molecules/SearchBar';
import {usePantryItems} from '../hooks';
import {StorageState, useHomeQuery} from '../graphql/generated';
import {UserHeader} from '../components/molecules/UserHeader';

export const MainScreen = () => {
  const {styles} = useStyles(stylesheet);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expiredCount, setExpiredCount] = useState(0);

  const {data: homeData} = useHomeQuery({
    fetchPolicy: 'cache-and-network',
  });

  const pantryId = homeData?.home?.defaultPantry?.id;
  const {items, query, setQuery, refetch} = usePantryItems(pantryId);

  return (
    <View style={styles.container}>
      <UserHeader />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Find an item…"
      />

      <ScrollView
        contentContainerStyle={styles.listContent}
        StickyHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={{fontSize: 16, fontWeight: 'bold'}}>
              Expired Items: {expiredCount}
            </Text>
          </View>
        )}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setIsRefreshing(true);
              refetch().finally(() => setIsRefreshing(false));
            }}
            refreshing={isRefreshing}
          />
        }>
        {items.map(pantryItem => {
          if (
            pantryItem.expiresAt &&
            new Date(pantryItem.expiresAt) < new Date()
          ) {
            setExpiredCount(prevCount => prevCount + 1);
          }
          return (
            <SwipeablePantryItem
              key={pantryItem.id}
              item={{
                id: pantryItem.id,
                itemName: pantryItem.item.name,
                quantity: `${pantryItem.quantity} ${pantryItem.unit.symbol}`,
                location:
                  pantryItem.storageState === StorageState.Frozen
                    ? 'Frozen'
                    : pantryItem.storageState === StorageState.Refrigerated
                      ? 'Refrigerated'
                      : 'Pantry',
                expirationText: pantryItem.expiresAt
                  ? `Expiring on ${new Date(pantryItem.expiresAt).toLocaleDateString()}`
                  : 'No expiration',
                icon: {uri: 'default_icon.png'},
              }}
              onDelete={() => () => {}}
              onEdit={() => {}}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1, backgroundColor: theme.colors.background},
  listContent: {paddingBottom: theme.spacing.sm},
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
}));
