import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation} from '@react-navigation/native';
import {useUnistyles} from 'react-native-unistyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import {commonStyles} from '#/styles/commonStyles';
import styles from './styles';
import {useDefaultHome} from '#hooks';
import {
  StorageState,
  useAddItemToPantryMutation,
  useGetHomeQuery,
  useGetUnitBySymbolLazyQuery,
  ItemSuggestion,
  GetPantryItemsDocument,
  PantryItemFragment,
} from '#generated';
import {EnhancedAutocompleteInput} from '#components/molecules/EnhancedAutocompleteInput';
import {UnitsAutocompleteInput} from '#components/molecules/UnitsAutocompleteInput';
import {BrandAutocompleteInput} from '#components/molecules/BrandAutocompleteInput';
import {Counter} from '#components/molecules/Counter';

const STORAGE_STATES = Object.values(StorageState);

export const AddPantryItem: React.FC = () => {
  const navigation = useNavigation();
  const {theme} = useUnistyles();

  const [itemName, setItemName] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [storageState, setStorageState] = useState(StorageState.Ambient);
  const [location, setLocation] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    selectedHomeId,
    loading: homesLoading,
    getDefaultPantry,
  } = useDefaultHome();

  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    skip: !selectedHomeId,
  });

  const [unitQuery] = useGetUnitBySymbolLazyQuery({
    fetchPolicy: 'network-only',
  });

  const pantry = getDefaultPantry(homeData);
  const [addItem] = useAddItemToPantryMutation({
    // Update cache immediately for optimistic UI
    update: (cache, {data: mutationData}) => {
      if (!mutationData?.addItemToPantry || !pantry?.id) return;

      const newItem = mutationData.addItemToPantry;

      try {
        // Read the current pantry items from cache
        const existingData = cache.readQuery<{
          pantryItems: PantryItemFragment[];
        }>({
          query: GetPantryItemsDocument,
          variables: {pantryId: pantry.id},
        });

        if (existingData?.pantryItems) {
          // Add the new item to the pantry items list
          cache.writeQuery({
            query: GetPantryItemsDocument,
            variables: {pantryId: pantry.id},
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
    onCompleted: () => {
      console.log('Pantry item added successfully');
    },
    onError: error => {
      console.error('Add pantry item error:', error);
    },
  });

  // Handle item selection from autocomplete
  const handleItemSelect = useCallback((item: ItemSuggestion) => {
    setItemName(item.name);
    setSelectedItemId(item.id); // Track that this is an existing item

    // Auto-populate other fields if available
    if (item.brand?.name) {
      setBrand(item.brand.name);
    }
    if (item.category?.name) {
      setCategory(item.category.name);
    }
    if (item.defaultUnit?.symbol) {
      setUnit(item.defaultUnit.symbol);
    }
  }, []);

  // Handle manual text change (clear selectedItemId for custom items)
  const handleItemNameChange = useCallback((text: string) => {
    setItemName(text);
    setSelectedItemId(null); // Clear selection when user types manually
  }, []);

  // Counter handlers
  const handleIncrementQuantity = useCallback(() => {
    setQuantity(prev => prev + 1);
  }, []);

  const handleDecrementQuantity = useCallback(() => {
    setQuantity(prev => Math.max(1, prev - 1));
  }, []);

  const handleSave = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    if (quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      const unitData = await unitQuery({
        variables: {symbol: unit.trim()},
      });
      const unitId = unitData.data?.unitBySymbol?.id || '';

      // Build input based on whether it's an existing item or new custom item
      const baseInput = {
        pantryId: pantry?.id || '',
        unitId: unitId,
        initialQuantity: quantity,
        storageState: storageState as StorageState,
        expiresAt: expirationDate?.toISOString() || null,
        storageNotes: notes.trim() || null,
        storageLocation: location.trim() || null,
      };

      let input: any;

      if (selectedItemId) {
        // Scenario A: Adding existing item (from autocomplete)
        input = {
          ...baseInput,
          itemId: selectedItemId,
        };
      } else {
        // Scenario B: Adding new custom item
        input = {
          ...baseInput,
          itemName: itemName.trim(),
          itemDescription: notes.trim() || null,
          itemBrand: brand.trim() || null,
          itemCategory: category.trim() || null,
        };
      }

      await addItem({
        variables: {input},
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to add item to pantry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={commonStyles.container}>
      {/* Header */}
      <View style={commonStyles.header}>
        <TouchableOpacity
          style={commonStyles.iconButton}
          onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={commonStyles.headerTitle}>Add Pantry Item</Text>
        <TouchableOpacity
          style={commonStyles.iconButton}
          onPress={handleSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={commonStyles.scrollContent}>
        <View style={commonStyles.padding}>
          {/* Item Name - Enhanced Autocomplete */}
          <EnhancedAutocompleteInput
            label="Item Name"
            value={itemName}
            onChangeText={handleItemNameChange}
            onSelectItem={handleItemSelect}
            placeholder="e.g., Rice, Pasta"
            required
            autoFocus
          />

          {/* Brand - Autocomplete */}
          <BrandAutocompleteInput
            label="Brand"
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g., Kellogg's"
          />

          {/* Quantity and Unit Row */}
          <View style={[commonStyles.row, commonStyles.gap]}>
            <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
              <Text style={commonStyles.label}>Quantity *</Text>
              <View style={styles.quantityContainer}>
                <Counter
                  count={quantity}
                  onIncrement={handleIncrementQuantity}
                  onDecrement={handleDecrementQuantity}
                />
              </View>
            </View>

            <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
              <UnitsAutocompleteInput
                label="Unit"
                value={unit}
                onChangeText={setUnit}
                placeholder="kg, lbs, pcs"
              />
            </View>
          </View>

          {/* Minimum Quantity */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Minimum Quantity</Text>
            <TextInput
              style={commonStyles.input}
              value={minimumQuantity}
              onChangeText={setMinimumQuantity}
              placeholder="Alert when below this quantity"
              placeholderTextColor={theme.colors.inputPlaceholder}
              keyboardType="numeric"
            />
          </View>

          {/* Storage Type */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Storage Type</Text>
            <View style={styles.segmentedControl}>
              {STORAGE_STATES.map(state => (
                <TouchableOpacity
                  key={state}
                  style={[
                    styles.segment,
                    storageState === state && styles.segmentActive,
                  ]}
                  onPress={() => setStorageState(state)}>
                  <Text
                    style={[
                      styles.segmentText,
                      storageState === state && styles.segmentTextActive,
                    ]}
                    numberOfLines={1}>
                    {state}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Location</Text>
            <TextInput
              style={commonStyles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., Top shelf, Drawer 2"
              placeholderTextColor={theme.colors.inputPlaceholder}
            />
          </View>

          {/* Expiration Date */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Expiration Date</Text>
            <TouchableOpacity
              style={[commonStyles.input, commonStyles.row, styles.dateInput]}
              onPress={() => setShowDatePicker(true)}>
              <Icon name="event" size={20} color={theme.colors.textSecondary} />
              <Text style={styles.dateText}>
                {expirationDate
                  ? expirationDate.toLocaleDateString()
                  : 'Select date'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={expirationDate || new Date()}
                mode="date"
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) setExpirationDate(date);
                }}
              />
            )}
          </View>

          {/* Category */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Category</Text>
            <TextInput
              style={commonStyles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Grains, Dairy"
              placeholderTextColor={theme.colors.inputPlaceholder}
            />
          </View>

          {/* Notes */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Notes</Text>
            <TextInput
              style={[commonStyles.input, commonStyles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
