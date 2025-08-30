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
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  useGetPantryItemQuery,
  useUpdatePantryItemMutation,
  StorageState,
} from '#generated';
import {commonStyles} from '#styles';

const STORAGE_STATES = ['AMBIENT', 'FROZEN', 'NONE', 'REFRIGERATED'];

export const EditPantryItem: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {theme} = useUnistyles();
  const {itemId} = route.params as {itemId: string};

  const [currentQuantity, setCurrentQuantity] = useState('');
  const [reservedQuantity, setReservedQuantity] = useState('');
  const [storageState, setStorageState] = useState<StorageState>(
    StorageState.Ambient,
  );
  const [storageLocation, setStorageLocation] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [storageNotes, setStorageNotes] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [isAutoReorder, setIsAutoReorder] = useState(false);
  const [autoReorderPoint, setAutoReorderPoint] = useState('');

  const {data, loading} = useGetPantryItemQuery({
    variables: {id: itemId},
  });

  const [updateItem] = useUpdatePantryItemMutation();

  useEffect(() => {
    if (data?.pantryItem) {
      const item = data.pantryItem;
      setCurrentQuantity(item.currentQuantity?.toString() || '');
      setReservedQuantity(item.reservedQuantity?.toString() || '');
      setStorageState(item.storageState || StorageState.Ambient);
      setStorageLocation(item.storageLocation || '');
      setStorageNotes(item.storageNotes || '');
      setCustomCategory(item.customCategory || '');
      setTags(item.tags || []);
      setIsAutoReorder(item.isAutoReorder || false);
      setAutoReorderPoint(item.autoReorderPoint?.toString() || '');
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
            currentQuantity: parseFloat(currentQuantity),
            reservedQuantity: parseFloat(reservedQuantity) || 0,
            storageState,
            storageLocation,
            expiresAt: expirationDate?.toISOString(),
            storageNotes,
            customCategory,
            tags,
            isAutoReorder,
            autoReorderPoint: parseFloat(autoReorderPoint) || undefined,
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
      <View style={[commonStyles.container, commonStyles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const itemName = data?.pantryItem?.item?.name || '';
  const unitSymbol = data?.pantryItem?.unit?.symbol || '';

  return (
    <View style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[commonStyles.title, styles.headerTitle]}>
          Edit Pantry Item
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form}>
        {/* Display item name (read-only) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Name</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyText}>{itemName}</Text>
          </View>
        </View>

        <View style={commonStyles.row}>
          <View style={[styles.inputGroup, {flex: 1}]}>
            <Text style={styles.label}>Current Quantity</Text>
            <TextInput
              style={[commonStyles.input, styles.input]}
              value={currentQuantity}
              onChangeText={setCurrentQuantity}
              placeholder="1"
              placeholderTextColor={theme.colors.inputPlaceholder}
              keyboardType="numeric"
            />
          </View>

          <View
            style={[
              styles.inputGroup,
              {flex: 1, marginLeft: theme.spacing.sm},
            ]}>
            <Text style={styles.label}>Unit</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{unitSymbol}</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Minimum Stock Level</Text>
          <TextInput
            style={[commonStyles.input, styles.input]}
            value={reservedQuantity}
            onChangeText={setReservedQuantity}
            placeholder="Alert when below this quantity"
            placeholderTextColor={theme.colors.inputPlaceholder}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Storage Type</Text>
          <View style={styles.segmentedControl}>
            {STORAGE_STATES.map(state => (
              <TouchableOpacity
                key={state}
                style={[
                  styles.segment,
                  storageState === state && styles.segmentActive,
                ]}
                onPress={() => setStorageState(state as StorageState)}>
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Storage Location</Text>
          <TextInput
            style={[commonStyles.input, styles.input]}
            value={storageLocation}
            onChangeText={setStorageLocation}
            placeholder="e.g., Top shelf, Drawer 2"
            placeholderTextColor={theme.colors.inputPlaceholder}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Expiration Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <TextInput
            style={[commonStyles.input, styles.input]}
            value={customCategory}
            onChangeText={setCustomCategory}
            placeholder="e.g., Grains, Dairy"
            placeholderTextColor={theme.colors.inputPlaceholder}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={commonStyles.rowSpaceBetween}>
            <Text style={styles.label}>Auto Reorder</Text>
            <TouchableOpacity
              style={[styles.toggle, isAutoReorder && styles.toggleActive]}
              onPress={() => setIsAutoReorder(!isAutoReorder)}>
              <Icon
                name={isAutoReorder ? 'check' : 'close'}
                size={16}
                color={
                  isAutoReorder
                    ? theme.colors.white
                    : theme.colors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
          {isAutoReorder && (
            <TextInput
              style={[
                commonStyles.input,
                styles.input,
                {marginTop: theme.spacing.sm},
              ]}
              value={autoReorderPoint}
              onChangeText={setAutoReorderPoint}
              placeholder="Reorder when quantity reaches..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              keyboardType="numeric"
            />
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Storage Notes</Text>
          <TextInput
            style={[commonStyles.input, styles.input, styles.textArea]}
            value={storageNotes}
            onChangeText={setStorageNotes}
            placeholder="Any additional notes..."
            placeholderTextColor={theme.colors.inputPlaceholder}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tags</Text>
          <TextInput
            style={[commonStyles.input, styles.input]}
            value={tags.join(', ')}
            onChangeText={text =>
              setTags(
                text
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              )
            }
            placeholder="Enter tags separated by commas"
            placeholderTextColor={theme.colors.inputPlaceholder}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  form: {
    padding: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    // Additional input styles if needed
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  readOnlyField: {
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  readOnlyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textTertiary,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  segmentTextActive: {
    color: theme.colors.white,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
  },
  dateText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.md,
  },
  toggle: {
    width: 32,
    height: 20,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: theme.colors.primary,
  },
}));
