import {useState} from 'react';
import {Alert} from 'react-native';
import type {ApolloCache} from '@apollo/client';
import {
  useCreateItemMutation,
  useAddItemToPantryMutation,
  StorageState,
  ItemType,
  useGetHomeQuery,
} from '#generated';
import {useDefaultHome} from './home/useDefaultHome';
import {CreateItemFormData as FormData} from '#utils/validation';
import { useErrorHandler } from '#/utils/errorHandling';

interface CreateItemAndAddToPantryInput {
  // Item creation data
  itemData: FormData;
  
  // Pantry addition data
  quantity: number;
  unitSymbol?: string;
  storageState?: StorageState;
  expiresAt?: string;
  storageLocation?: string;
  storageNotes?: string;
  minimumQuantity?: number;
}

export const useCreateItemAndAddToPantry = () => {
  const [loading, setLoading] = useState(false);
  const { handleApolloError } = useErrorHandler();

  const {selectedHomeId, getDefaultPantry} = useDefaultHome();
  
  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    skip: !selectedHomeId,
  });
  
  const [createItem] = useCreateItemMutation();
  
  const [addToPantry] = useAddItemToPantryMutation({
    // Update cache using cache.modify for consistency
    update: (cache: ApolloCache, {data: mutationData}, {variables}) => {
      if (!mutationData?.addItemToPantry || !variables?.input.pantryId) return;

      const newItem = mutationData.addItemToPantry;

      try {
        // Use cache.modify for better performance and consistency
        cache.modify({
          fields: {
            pantryItems: (existingItems = []) => {
              // Add the new item to the list
              return [...existingItems, newItem];
            },
          },
        });
      } catch (error) {
        const { message } = handleApolloError(error, {
          operation: 'Add Item to Pantry Cache Update',
        });
        console.warn('Cache update failed:', message);
        // Cache update failed, but mutation still succeeded
      }
    },
    onError: (error) => {
      const { message } = handleApolloError(error, {
        operation: 'Add Item to Pantry',
      });
      Alert.alert('Error', message);
    },
  });

  const createItemAndAddToPantry = async (input: CreateItemAndAddToPantryInput) => {
    if (!selectedHomeId) {
      Alert.alert('Error', 'No home selected');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create the item with new schema structure
      const processedItemData = {
        name: input.itemData.name,
        description: input.itemData.description || undefined,
        upc: input.itemData.upc || undefined,
        sku: input.itemData.sku || undefined,
        netWeight: input.itemData.netWeight || undefined,
        displayUnitId: input.itemData.displayUnitId || undefined,
        
        // Classification
        type: input.itemData.type as ItemType | undefined,
        storageState: input.itemData.storageState as StorageState | undefined,
        
        // Product Details
        shelfLifeDays: input.itemData.shelfLifeDays || undefined,
        
        // Images
        imageUrl: input.itemData.imageUrl || undefined,
        
        // Brand Information
        brandId: input.itemData.brandId || undefined,
        
        // Categories
        categoryIds: input.itemData.categoryIds || undefined,
        
        // Units array
        units: input.itemData.units || undefined,
        
        // Metadata
        tags: input.itemData.tags?.filter((tag): tag is string => Boolean(tag)) || undefined,
      };

      const createItemResult = await createItem({
        variables: {
          input: processedItemData,
        },
      });

      if (!createItemResult.data?.createItem) {
        throw new Error('Failed to create item');
      }

      const newItem = createItemResult.data.createItem;

      // Step 2: Get the default pantry using the home data
      const defaultPantry = getDefaultPantry(homeData);
      const pantryId = defaultPantry?.id;
      
      if (!pantryId) {
        Alert.alert('Error', 'No default pantry found');
        return;
      }

      // Step 3: Add the newly created item to the pantry
      const pantryInput = {
        pantryId: pantryId,
        itemId: newItem.id,
        initialQuantity: input.quantity,
        storageState: input.storageState || StorageState.Ambient,
        expiresAt: input.expiresAt || undefined,
        storageLocation: input.storageLocation || undefined,
        storageNotes: input.storageNotes || undefined,
        unitId: '', // We'll need to resolve this from the unit symbol
      };

      const addToPantryResult = await addToPantry({
        variables: {
          input: pantryInput,
        },
      });

      if (addToPantryResult.data?.addItemToPantry) {
        Alert.alert(
          'Success', 
          'Item created and added to pantry successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // You might want to navigate back or refresh the pantry list
              },
            },
          ]
        );
        return addToPantryResult.data.addItemToPantry;
      }
      
    } catch (error) {
      const { message } = handleApolloError(error, {
        operation: 'Create Item and Add to Pantry',
      });
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return {
    createItemAndAddToPantry,
    loading,
  };
};