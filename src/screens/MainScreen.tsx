import React, {useState, useMemo} from 'react';
import {ScrollView, RefreshControl, View} from 'react-native';
import {SwipeablePantryItem} from '../components/organisms/SwipeablePantryItem';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import SearchBar from '../components/molecules/SearchBar';
import {useSearchableList} from '../hooks/useSearchableList';
import {
  StorageState,
  usePantryItemsQuery,
  useHomeQuery,
} from '../graphql/generated';

export const MainScreen = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // get available pantries and homes
  const {data: homeData} = useHomeQuery({
    fetchPolicy: 'cache-and-network',
    skip: false,
  });

  const home = useMemo(() => homeData?.home, [homeData]);

  const {data: pantryItemsData, refetch: refetchPantryItems} =
    usePantryItemsQuery({
      fetchPolicy: 'cache-and-network',
      skip: false,
      variables: {
        pantryId: home?.defaultPantry?.id ?? '',
      },
    });

  const pantryItems = useMemo(
    () => pantryItemsData?.pantryItems || [],
    [pantryItemsData],
  );
  const {query, setQuery, filtered} = useSearchableList(
    pantryItems,
    (pantryItem, q) =>
      pantryItem?.item?.name?.toLowerCase().includes(q.toLowerCase()),
  );
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Find an item…"
        containerStyle={{marginHorizontal: 12}}
      />

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setIsRefreshing(true);
              refetchPantryItems().finally(() => {
                setIsRefreshing(false);
              });
            }}
            refreshing={isRefreshing}
          />
        }>
        {filtered.map(pantryItem => (
          <SwipeablePantryItem
            key={pantryItem.id}
            item={{
              id: pantryItem.id,
              itemName: pantryItem.item.name,
              quantity: `${pantryItem.quantity} ${pantryItem.unit.symbol}`,
              location:
                pantryItem.storageState === StorageState.Frozen
                  ? 'Frozen'
                  : pantryItem.storageState === StorageState.Cold
                    ? 'Refrigerated'
                    : 'Pantry',
              expirationText: pantryItem.expiresAt
                ? `Expiring on ${new Date(pantryItem.expiresAt).toLocaleDateString()}`
                : 'No expiration',
              expiredCount:
                pantryItem.expiresAt &&
                new Date(pantryItem.expiresAt) < new Date()
                  ? 1
                  : 0,
              icon: {uri: 'default_icon.png'},
            }}
            onDelete={() => () => {}}
            onEdit={() => {}}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1},
  listContent: {paddingBottom: theme.spacing.sm},
}));
