import {useState} from 'react';
import {Alert} from 'react-native';
import {
  useCreateItemMutation,
  useAddItemToPantryMutation,
  StorageState,
  ItemType,
  DataSource,
  ItemStatus,
  Visibility,
  GetPantryItemsDocument,
  PantryItemFragment,
  useGetHomeQuery,
} from '#generated';
import {useDefaultHome} from './home/useDefaultHome';
import {CreateItemFormData as FormData} from '#utils/validation';

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
  
  const {selectedHomeId, getDefaultPantry} = useDefaultHome();
  
  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    skip: !selectedHomeId,
  });
  
  const [createItem] = useCreateItemMutation({
    onError: (error) => {
      console.error('Create item error:', error);
      Alert.alert('Error', `Failed to create item: ${error.message}`);
    },
  });
  
  const [addToPantry] = useAddItemToPantryMutation({
    // Update cache immediately for optimistic UI
    update: (cache, {data: mutationData}, {variables}) => {
      if (!mutationData?.addItemToPantry || !variables?.input.pantryId) return;

      const newItem = mutationData.addItemToPantry;

      try {
        // Read the current pantry items from cache
        const existingData = cache.readQuery<{
          pantryItems: PantryItemFragment[];
        }>({
          query: GetPantryItemsDocument,
          variables: {pantryId: variables.input.pantryId},
        });

        if (existingData?.pantryItems) {
          // Add the new item to the pantry items list
          cache.writeQuery({
            query: GetPantryItemsDocument,
            variables: {pantryId: variables.input.pantryId},
            data: {
              pantryItems: [...existingData.pantryItems, newItem],
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed:', error);
        // Cache update failed, but mutation still succeeded
      }
    },
    onError: (error) => {
      console.error('Add to pantry error:', error);
      Alert.alert('Error', `Failed to add item to pantry: ${error.message}`);
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
        expiresAt: input.expiresAt || null,
        storageLocation: input.storageLocation || null,
        storageNotes: input.storageNotes || null,
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
      console.error('Error in createItemAndAddToPantry:', error);
      Alert.alert(
        'Error', 
        'Failed to create item and add to pantry. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    createItemAndAddToPantry,
    loading,
  };
};