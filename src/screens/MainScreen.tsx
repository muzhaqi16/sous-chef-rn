import React, {useEffect} from 'react';
import {ScrollView, RefreshControl, View} from 'react-native';
import {useStore} from '../store/useStore';
import {SwipeablePantryItem} from '../components/organisms/SwipeablePantryItem';
import {StorageState} from '../api/graphql/generated';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import SearchBar from '../components/molecules/SearchBar';
import {useSearchableList} from '../hooks/useSearchableList';

export const MainScreen = () => {
  const {pantryItems, fetchPantryItems, deletePantryItem, editPantryItem} =
    useStore();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const {query, setQuery, filtered} = useSearchableList(
    pantryItems,
    (item, q) => item.itemName.toLowerCase().includes(q.toLowerCase()),
  );
  const {styles} = useStyles(stylesheet);
  useEffect(() => {
    // Fetch pantry items when the component mounts
    setIsRefreshing(true);
    fetchPantryItems()
      .then(() => {
        console.log('Pantry items fetched successfully');
      })
      .catch(error => {
        console.error('Error fetching pantry items:', error);
      });
    setIsRefreshing(false);
  }, [fetchPantryItems]);

  return (
    <View style={styles.container}>
      {/* Action Bar */}
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Find an item…"
        containerStyle={{marginHorizontal: 12}}
      />
      {/* Pantry Items List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            onRefresh={fetchPantryItems}
            refreshing={isRefreshing}
          />
        }>
        {pantryItems.map(pantryItem => (
          <SwipeablePantryItem
            key={pantryItem.id}
            item={{
              id: pantryItem.id,
              itemName: pantryItem.itemName,
              quantity: `${pantryItem.quantity} ${pantryItem.unitSymbol}`,
              location:
                pantryItem.item.storageState === StorageState.Frozen
                  ? 'Frozen'
                  : pantryItem.item.storageState === StorageState.Cold
                    ? 'Refrigerated'
                    : 'Pantry',
              expirationText: pantryItem.expirationDate
                ? `Expiring in …`
                : 'No expiration',
              expiredCount:
                pantryItem.expirationDate &&
                new Date(pantryItem.expirationDate) < new Date()
                  ? 1
                  : 0, // Example logic for expired count
              icon: {uri: pantryItem?.item?.imageUrl || 'default_icon.png'}, // Fallback icon
            }}
            onDelete={deletePantryItem}
            onEdit={(id: string) => {
              // Handle edit action, e.g., open a modal or navigate to edit screen
              console.log('Edit item with id:', id);
              editPantryItem(id, {
                itemName: 'Edited Item Name', // Example edit data
                unitSymbol: 'kg',
                storageState: StorageState.Ambient,
                expirationDate: null, // Example edit data
              });
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
  },
  searchBar: {},

  rowContainer: {
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.padding.sm,
  },
}));
