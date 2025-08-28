import React, {useState, useEffect} from 'react';
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
import {useNavigation, useRoute} from '@react-navigation/native';
import {StyleSheet} from 'react-native-unistyles';
import {useGetPantryItemQuery, useUpdatePantryItemMutation} from '#generated';

const STORAGE_STATES = ['PANTRY', 'REFRIGERATED', 'FROZEN'];

export const EditPantryItem: React.FC = () => {
  const {styles, theme} = useStyles(sharedStylesheet);
  const navigation = useNavigation();
  const route = useRoute();
  const {itemId} = route.params as {itemId: string};

  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [storageState, setStorageState] = useState('PANTRY');
  const [location, setLocation] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const {data, loading} = useGetPantryItemQuery({
    variables: {id: itemId},
  });

  const [updateItem] = useUpdatePantryItemMutation();

  useEffect(() => {
    if (data?.pantryItem) {
      const item = data.pantryItem;
      setItemName(item.item?.name || '');
      setBrand(item.item?.brand || '');
      setCurrentQuantity(item.currentQuantity?.toString() || '');
      setMinimumQuantity(item.minimumQuantity?.toString() || '');
      setUnit(item.unit?.symbol || '');
      setStorageState(item.storageState || 'PANTRY');
      setLocation(item.location || '');
      setNotes(item.notes || '');
      setCategory(item.category || '');
      if (item.expiresAt) {
        setExpirationDate(new Date(item.expiresAt));
      }
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateItem({
        variables: {
          id: itemId,
          input: {
            itemName,
            brand,
            currentQuantity: parseFloat(currentQuantity),
            minimumQuantity: parseFloat(minimumQuantity) || 0,
            unitName: unit,
            storageState,
            location,
            expiresAt: expirationDate?.toISOString(),
            notes,
            category,
          },
        },
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Pantry Item</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form}>
        {/* Same form fields as AddPantryItem */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Name *</Text>
          <TextInput
            style={styles.input}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g., Rice, Pasta"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, {flex: 1}]}>
            <Text style={styles.label}>Current Quantity</Text>
            <TextInput
              style={styles.input}
              value={currentQuantity}
              onChangeText={setCurrentQuantity}
              placeholder="1"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, {flex: 1, marginLeft: 12}]}>
            <Text style={styles.label}>Unit</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="kg, lbs, pcs"
            />
          </View>
        </View>

        {/* Rest of the form fields same as AddPantryItem */}
      </ScrollView>
    </View>
  );
};

// Shared Stylesheets - Reusing from shopping list patterns
const sharedStylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: 'white',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  segmentTextActive: {
    color: 'white',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginLeft: 12,
  },
}));
