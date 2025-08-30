import React, {useState} from 'react';
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
import styles from './AddPantryItem.styles';
import {useDefaultHome} from '#hooks';
import {
  StorageState,
  useAddItemToPantryMutation,
  useGetHomeQuery,
  useGetUnitBySymbolLazyQuery,
} from '#generated';

const STORAGE_STATES = ['AMBIENT', 'FROZEN', 'NONE', 'REFRIGERATED'];

export const AddPantryItem: React.FC = () => {
  const navigation = useNavigation();
  const {theme} = useUnistyles();

  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [storageState, setStorageState] = useState('AMBIENT');
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
  const [addItem] = useAddItemToPantryMutation();

  const handleSave = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    if (!quantity.trim()) {
      Alert.alert('Error', 'Please enter a quantity');
      return;
    }

    setSaving(true);
    try {
      const unitData = await unitQuery({
        variables: {symbol: unit.trim()},
      });
      const unitId = unitData.data?.unitBySymbol?.id || '';
      await addItem({
        variables: {
          input: {
            pantryId: pantry?.id || '',
            initialQuantity: parseFloat(quantity),
            storageState: storageState as StorageState,
            expiresAt: expirationDate?.toISOString(),
            itemId: '',
            unitId: unitId,
          },
        },
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
          {/* Item Name */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Item Name *</Text>
            <TextInput
              style={commonStyles.input}
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g., Rice, Pasta"
              placeholderTextColor={theme.colors.inputPlaceholder}
              autoFocus
            />
          </View>

          {/* Brand */}
          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>Brand</Text>
            <TextInput
              style={commonStyles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g., Kellogg's"
              placeholderTextColor={theme.colors.inputPlaceholder}
            />
          </View>

          {/* Quantity and Unit Row */}
          <View style={[commonStyles.row, commonStyles.gap]}>
            <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
              <Text style={commonStyles.label}>Quantity *</Text>
              <TextInput
                style={commonStyles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor={theme.colors.inputPlaceholder}
                keyboardType="numeric"
              />
            </View>

            <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
              <Text style={commonStyles.label}>Unit</Text>
              <TextInput
                style={commonStyles.input}
                value={unit}
                onChangeText={setUnit}
                placeholder="kg, lbs, pcs"
                placeholderTextColor={theme.colors.inputPlaceholder}
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
                    ]}>
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
