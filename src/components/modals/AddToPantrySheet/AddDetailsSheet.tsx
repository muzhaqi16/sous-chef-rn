import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import PagerView from 'react-native-pager-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { InlineItemAutocomplete } from '#components/molecules/InlineItemAutocomplete';
import { InlineUnitsAutocomplete } from '#components/molecules/InlineUnitsAutocomplete';
import { InlineBrandAutocomplete } from '#components/molecules/InlineBrandAutocomplete';
import {
  InlineStorageLocationAutocomplete,
  StorageLocation,
} from '#components/molecules/InlineStorageLocationAutocomplete';
import { FieldRow } from '#components/molecules/FieldRow';
import { parseFractionalInput } from '#/utils';
import {
  StorageState,
  useCreatePantryItemMutation,
  ItemSuggestion,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';

const STORAGE_STATES = Object.values(StorageState);
const PAGES = ['Main', 'Details', 'Storage'] as const;

interface AddDetailsSheetProps {
  visible: boolean;
  pantryId: string | undefined;
  prefilledItemName?: string;
  storageLocations?: StorageLocation[];
  onClose: () => void;
  onSuccess: () => void;
}

// Page Indicator Component
const PageIndicator: React.FC<{
  pages: readonly string[];
  currentPage: number;
  onPagePress: (index: number) => void;
}> = ({ pages, currentPage, onPagePress }) => {
  const { theme } = useUnistyles();

  return (
    <View style={indicatorStyles.container}>
      {pages.map((label, index) => (
        <TouchableOpacity
          key={label}
          onPress={() => onPagePress(index)}
          style={indicatorStyles.item}
        >
          <View
            style={[
              indicatorStyles.dot,
              {
                backgroundColor:
                  currentPage === index
                    ? theme.colors.primary
                    : theme.colors.border,
              },
            ]}
          />
          <Text
            style={[
              indicatorStyles.label,
              {
                color:
                  currentPage === index
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                fontWeight: currentPage === index ? '600' : '400',
              },
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const indicatorStyles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  item: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: theme.fonts.size.sm,
  },
}));

export const AddDetailsSheet: React.FC<AddDetailsSheetProps> = ({
  visible,
  pantryId,
  prefilledItemName = '',
  storageLocations = [],
  onClose,
  onSuccess,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const pagerRef = useRef<PagerView>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  // Page state
  const [currentPage, setCurrentPage] = useState(0);

  // Form state - Page 1 (Main)
  const [itemName, setItemName] = useState('');
  const [selectedItem, setSelectedItem] = useState<ItemSuggestion | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [unit, setUnit] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [storageState, setStorageState] = useState<StorageState>(
    StorageState.Ambient,
  );

  // Form state - Page 2 (Details)
  const [packageWeight, setPackageWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('');
  const [weightUnitId, setWeightUnitId] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState('');
  const [expirationDateObj, setExpirationDateObj] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state - Page 3 (Storage)
  const [storageLocation, setStorageLocation] = useState('');
  const [selectedStorageLocationId, setSelectedStorageLocationId] = useState<string | null>(null);
  const [storageNotes, setStorageNotes] = useState('');
  const [tags, setTags] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [suggestedBrands, setSuggestedBrands] = useState<{ id: string; name: string }[]>([]);

  // Form state - Add Another toggle
  const [addAnother, setAddAnother] = useState(false);

  // Create mutation
  const [createPantryItem, { loading }] = useCreatePantryItemMutation({
    update: (cache, { data }) => {
      if (!data?.createPantryItem || !pantryId) return;

      try {
        const addToPantryCache = createAddToParentConnectionUpdater(
          'Pantry',
          'itemsConnection',
          'PantryItem',
        );
        addToPantryCache(cache, pantryId, data.createPantryItem);
      } catch (error) {
        console.warn('Cache update failed for createPantryItem:', error);
      }
    },
  });

  // Reset form for adding another item
  const resetForm = useCallback(() => {
    setItemName('');
    setSelectedItem(null);
    setQuantityInput('1');
    setUnit('');
    setUnitId(null);
    setStorageState(StorageState.Ambient);
    setPackageWeight('');
    setWeightUnit('');
    setWeightUnitId(null);
    setExpirationDate('');
    setExpirationDateObj(null);
    setShowDatePicker(false);
    setStorageLocation('');
    setSelectedStorageLocationId(null);
    setStorageNotes('');
    setTags('');
    setBrand('');
    setSelectedBrandId(null);
    setSuggestedBrands([]);
  }, []);

  // Control visibility
  useEffect(() => {
    if (visible && pantryId) {
      bottomSheetRef.current?.present();
      // Reset form
      resetForm();
      setItemName(prefilledItemName);
      setCurrentPage(0);
      pagerRef.current?.setPage(0);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryId, prefilledItemName, resetForm]);

  // Handle item selection from autocomplete
  const handleItemSelect = useCallback((item: ItemSuggestion) => {
    setSelectedItem(item);
    setItemName(item.name);
    // Set suggested brands from item
    if (item.brands && item.brands.length > 0) {
      setSuggestedBrands(item.brands.map(b => ({ id: b.id, name: b.name })));
      setBrand(item.brands[0].name);
    } else {
      setSuggestedBrands([]);
    }
  }, []);

  // Handle item name change (manual entry)
  const handleItemNameChange = useCallback(
    (name: string) => {
      setItemName(name);
      if (selectedItem && name !== selectedItem.name) {
        setSelectedItem(null);
      }
    },
    [selectedItem],
  );

  // Handle unit selection
  const handleUnitSelected = useCallback(
    (id: string | null, name: string | null) => {
      setUnitId(id);
      if (name) setUnit(name);
    },
    [],
  );

  // Handle weight unit selection
  const handleWeightUnitSelected = useCallback(
    (id: string | null, name: string | null) => {
      setWeightUnitId(id);
      if (name) setWeightUnit(name);
    },
    [],
  );

  // Handle date picker change
  const handleDateChange = useCallback(
    (_event: any, date?: Date) => {
      setShowDatePicker(Platform.OS === 'ios');
      if (date) {
        setExpirationDateObj(date);
        setExpirationDate(date.toISOString().split('T')[0]);
      }
    },
    [],
  );

  // Handle storage location selection
  const handleStorageLocationSelected = useCallback(
    (locationId: string | null, location: StorageLocation | null) => {
      setSelectedStorageLocationId(locationId);
      // Auto-set storage state based on location temperature
      if (location?.temperature) {
        const temp = location.temperature.toLowerCase();
        if (temp === 'frozen') setStorageState(StorageState.Frozen);
        else if (temp === 'refrigerated') setStorageState(StorageState.Refrigerated);
        else setStorageState(StorageState.Ambient);
      }
    },
    [],
  );

  // Handle add new storage location
  const handleAddNewLocation = useCallback((name: string) => {
    setStorageLocation(name);
    setSelectedStorageLocationId(null);
  }, []);

  // Handle brand selection
  const handleBrandSelected = useCallback(
    (brandId: string | null, _brandName: string | null) => {
      setSelectedBrandId(brandId);
    },
    [],
  );

  // Handle page change
  const handlePageChange = useCallback((index: number) => {
    setCurrentPage(index);
    pagerRef.current?.setPage(index);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!pantryId) return;

    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      handlePageChange(0);
      return;
    }

    const quantity = parseFractionalInput(quantityInput);
    if (quantity === null || isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      handlePageChange(0);
      return;
    }

    try {
      await createPantryItem({
        variables: {
          input: {
            pantryId,
            itemId: selectedItem?.id,
            itemName: itemName.trim(),
            initialQuantity: quantity,
            unitId: unitId || undefined,
            storageState,
            packageWeight: packageWeight
              ? parseFloat(packageWeight)
              : undefined,
            packageWeightUnitId: weightUnitId || undefined,
            expiresAt: expirationDate || undefined,
            // Use storage location ID if selected, otherwise use name for server to create
            storageLocationId: selectedStorageLocationId || undefined,
            storageLocationName: !selectedStorageLocationId && storageLocation.trim()
              ? storageLocation.trim()
              : undefined,
            storageNotes: storageNotes.trim() || undefined,
            tags: tags
              ? tags
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean)
              : undefined,
            itemBrand: brand.trim() || undefined,
          },
        },
      });

      if (addAnother) {
        resetForm();
        setCurrentPage(0);
        pagerRef.current?.setPage(0);
      } else {
        onSuccess();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  }, [
    pantryId,
    itemName,
    quantityInput,
    selectedItem,
    unitId,
    storageState,
    packageWeight,
    weightUnitId,
    expirationDate,
    selectedStorageLocationId,
    storageLocation,
    storageNotes,
    tags,
    brand,
    addAnother,
    createPantryItem,
    onSuccess,
    resetForm,
    handlePageChange,
  ]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['90%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      backdropComponent={props => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Icon
              name="arrow-back"
              size={24}
              color={theme.colors.textPrimary}
              library="MaterialIcons"
            />
          </TouchableOpacity>
          <Text style={styles.title}>Add Item Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Page Indicators */}
        <PageIndicator
          pages={PAGES}
          currentPage={currentPage}
          onPagePress={handlePageChange}
        />

        {/* Swipeable Pages */}
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          scrollEnabled={false}
          onPageSelected={e => setCurrentPage(e.nativeEvent.position)}
        >
          {/* Page 1: Main */}
          <BottomSheetScrollView
            key="main"
            style={styles.page}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Item Name */}
            <View style={styles.section}>
              <InlineItemAutocomplete
                label="Item Name"
                required
                value={itemName}
                onChangeText={handleItemNameChange}
                onSelectItem={handleItemSelect}
                placeholder="e.g., Milk, Eggs, Bread..."
              />
            </View>

            {/* Quantity + Unit */}
            <FieldRow>
              <FractionInput
                label="Quantity *"
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder="e.g., 1, 1/2"
              />
              <InlineUnitsAutocomplete
                label="Unit"
                value={unit}
                onChangeText={setUnit}
                onUnitSelected={handleUnitSelected}
                placeholder="pcs, dozen"
              />
            </FieldRow>

            {/* Storage State */}
            <View style={styles.section}>
              <Text style={styles.label}>Storage</Text>
              <View style={styles.segmentedControl}>
                {STORAGE_STATES.map(state => (
                  <TouchableOpacity
                    key={state}
                    style={[
                      styles.segment,
                      storageState === state && styles.segmentActive,
                    ]}
                    onPress={() => setStorageState(state)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        storageState === state && styles.segmentTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {state}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </BottomSheetScrollView>
          {/* Page 2: Details */}
          <BottomSheetScrollView
            key="details"
            style={styles.page}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Package Weight + Weight Unit */}
            <FieldRow>
              <FormInput
                label="Package Weight"
                value={packageWeight}
                onChangeText={setPackageWeight}
                placeholder="e.g., 300"
                keyboardType="decimal-pad"
              />
              <InlineUnitsAutocomplete
                label="Weight Unit"
                value={weightUnit}
                onChangeText={setWeightUnit}
                onUnitSelected={handleWeightUnitSelected}
                placeholder="g, kg, oz"
              />
            </FieldRow>

            {/* Expiration Date */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Expiration Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon
                  name="event"
                  size={20}
                  color={theme.colors.textSecondary}
                  library="MaterialIcons"
                />
                <Text
                  style={[
                    styles.dateText,
                    !expirationDateObj && styles.datePlaceholder,
                  ]}
                >
                  {expirationDateObj
                    ? expirationDateObj.toLocaleDateString()
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expirationDateObj || new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              )}
            </View>
          </BottomSheetScrollView>

          {/* Page 3: Storage */}
          <BottomSheetScrollView
            key="storage"
            style={styles.page}
            contentContainerStyle={[styles.pageContent, { overflow: 'visible' }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Storage Location */}
            <View style={[styles.section, { zIndex: 20 }]}>
              <InlineStorageLocationAutocomplete
                label="Storage Location"
                value={storageLocation}
                onChangeText={setStorageLocation}
                placeholder="e.g., Top shelf, Crisper drawer"
                storageLocations={storageLocations}
                onStorageLocationSelected={handleStorageLocationSelected}
                onAddNewLocation={handleAddNewLocation}
              />
            </View>

            {/* Brand */}
            <View style={[styles.section, { zIndex: 10 }]}>
              <InlineBrandAutocomplete
                label="Brand"
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g., Whole Foods, Organic Valley"
                suggestedBrands={suggestedBrands}
                onBrandSelected={handleBrandSelected}
              />
            </View>

            {/* Tags */}
            <View style={styles.section}>
              <FormInput
                label="Tags"
                value={tags}
                onChangeText={setTags}
                placeholder="e.g., organic, gluten-free (comma separated)"
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <FormInput
                label="Notes"
                value={storageNotes}
                onChangeText={setStorageNotes}
                placeholder="e.g., Store in cool, dry place"
                multiline
              />
            </View>
          </BottomSheetScrollView>
        </PagerView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {/* Add Another Toggle */}
          <View style={styles.toggleSection}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Add another item</Text>
              <Text style={styles.toggleDescription}>
                Keep adding after this one
              </Text>
            </View>
            <Switch
              value={addAnother}
              onValueChange={setAddAnother}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={styles.confirmButtonText}>
                {loading ? 'Adding...' : 'Add to Pantry'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  backButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    minHeight: '100%',
    flexGrow: 1,
  },
  pageContent: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  fieldLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.inputText,
  },
  datePlaceholder: {
    color: theme.colors.textSecondary,
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
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
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
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleLabel: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  toggleDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
  },
  confirmButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.onPrimary || '#FFFFFF',
  },
}));
