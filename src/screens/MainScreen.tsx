import React, {useEffect} from 'react';
import {ScrollView} from 'react-native';
import {useStore} from '../store/useStore';
import {SwipeablePantryItem} from '../components/organisms/SwipeablePantryItem';
import {StorageState} from '../api/graphql/generated';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

export const MainScreen = () => {
  const {pantryItems, fetchPantryItems, deletePantryItem, editPantryItem} =
    useStore();
  const {styles} = useStyles(stylesheet);
  useEffect(() => {
    fetchPantryItems().catch(console.error);
  }, [fetchPantryItems]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.listContent}>
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
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  rowContainer: {
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.padding.sm,
  },
}));
