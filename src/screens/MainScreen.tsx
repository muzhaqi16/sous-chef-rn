import React, {useEffect, useState, useMemo} from 'react';
import {ScrollView, RefreshControl, View} from 'react-native';
import {useStore} from '../store';
import {SwipeablePantryItem} from '../components/organisms/SwipeablePantryItem';
import {StorageState} from '../api/graphql/generated';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import SearchBar from '../components/molecules/SearchBar';
import {useSearchableList} from '../hooks/useSearchableList';

export const MainScreen = () => {
  // 1) Subscribe to the normalized slices separately
  const pantryIds = useStore(s => s.pantryIds);
  const pantryById = useStore(s => s.pantryById);

  // 2) Turn them into your flat array with useMemo
  const pantryItems = useMemo(
    () => pantryIds.map(id => pantryById[id]),
    [pantryIds, pantryById],
  );

  // 2) grab your async thunks:
  const fetchPantryItems = useStore(s => s.fetchPantryItems);
  const deletePantryItem = useStore(s => s.deletePantryItem);
  const editPantryItem = useStore(s => s.editPantryItem);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const {query, setQuery, filtered} = useSearchableList(
    pantryItems,
    (item, q) => item.itemName.toLowerCase().includes(q.toLowerCase()),
  );
  const {styles} = useStyles(stylesheet);

  // 3) initial load
  useEffect(() => {
    setIsRefreshing(true);
    fetchPantryItems().finally(() => setIsRefreshing(false));
  }, [fetchPantryItems]);

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
              fetchPantryItems().finally(() => setIsRefreshing(false));
            }}
            refreshing={isRefreshing}
          />
        }>
        {filtered.map(pantryItem => (
          <SwipeablePantryItem
            key={pantryItem.id}
            item={{
              id: pantryItem.id,
              itemName: pantryItem.itemName,
              quantity: `${pantryItem.quantity} ${pantryItem.unitSymbol}`,
              location:
                pantryItem.storageState === StorageState.Frozen
                  ? 'Frozen'
                  : pantryItem.storageState === StorageState.Cold
                    ? 'Refrigerated'
                    : 'Pantry',
              expirationText: pantryItem.expirationDate
                ? `Expiring on ${new Date(pantryItem.expirationDate).toLocaleDateString()}`
                : 'No expiration',
              expiredCount:
                pantryItem.expirationDate &&
                new Date(pantryItem.expirationDate) < new Date()
                  ? 1
                  : 0,
              icon: {uri: pantryItem.item.imageUrl || 'default_icon.png'},
            }}
            onDelete={() => deletePantryItem(pantryItem.id)}
            onEdit={() =>
              editPantryItem(pantryItem.id, {
                itemName: 'Edited Item Name',
                unitSymbol: 'kg',
                storageState: StorageState.Ambient,
                expirationDate: null,
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1},
  listContent: {paddingBottom: theme.spacing.padding.sm},
}));
