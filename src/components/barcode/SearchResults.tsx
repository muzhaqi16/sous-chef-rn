import React from 'react';
import {ScrollView, Alert} from 'react-native';
import {ItemCard} from './ItemCard';
import {ActionButtons} from './ActionButtons';
import {StyleSheet} from 'react-native-unistyles';
import {
  useAddItemToPantryMutation,
  useAddItemToShoppingListMutation,
} from '#generated';

interface SearchResultsProps {
  item: any;
  format?: string;
  onScanAnother: () => void;
  source?: 'pantry' | 'shoppingList';
  pantryId?: string;
  shoppingListId?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  item,
  format,
  onScanAnother,
  source,
  pantryId,
  shoppingListId,
}) => {
  const [addToPantry] = useAddItemToPantryMutation();
  const [addToShoppingList] = useAddItemToShoppingListMutation();

  const handleAddItem = async () => {
    if (!source) {
      Alert.alert('Error', 'No destination specified');
      return;
    }

    try {
      if (source === 'pantry' && pantryId) {
        // Debug: Log the item structure
        console.log('Item data:', JSON.stringify(item, null, 2));

        await addToPantry({
          variables: {
            input: {
              pantryId,
              itemId: item.id,
              initialQuantity: 1,
              itemName: item.name,
              unitId: item.unitId,
            },
          },
        });
      } else if (source === 'shoppingList' && shoppingListId) {
        // Get the default unit or first unit from the item
        const defaultUnit =
          item.units?.find((u: any) => u.isDefault) || item.units?.[0];
        const unitId = defaultUnit?.unitId;
        const unitName = defaultUnit?.unit?.symbol;

        await addToShoppingList({
          variables: {
            input: {
              shoppingListId,
              itemId: item.id,
              quantity: 1,
              itemName: item.name,
              unitId: unitId,
              unitName: unitName,
            },
          },
        });
      } else {
        Alert.alert('Error', 'Missing required information');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  };

  // Determine button label based on source
  const getButtonLabel = () => {
    switch (source) {
      case 'pantry':
        return 'Add to Pantry';
      case 'shoppingList':
        return 'Add to Shopping List';
      default:
        return 'Add Item';
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}>
      <ItemCard item={item} format={format} />

      <ActionButtons
        primaryAction={{
          label: getButtonLabel(),
          onPress: handleAddItem,
        }}
        secondaryAction={{
          label: 'Scan Another',
          onPress: onScanAnother,
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
}));
