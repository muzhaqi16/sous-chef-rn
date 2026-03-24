import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { alertService } from '#/services/alertService';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { Header } from '#components/molecules/Header';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { Icon } from '#utils/iconUtils';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { StorageState, ShoppingListItemDisplayFragment } from '#generated';

const STORAGE_STATES = Object.values(StorageState);

interface MoveToPantryModalProps {
  visible: boolean;
  shoppingListItem: ShoppingListItemDisplayFragment | null;
  pantries: Array<{ id: string; name: string; isDefault: boolean }>;
  selectedPantryId: string | null;
  onClose: () => void;
  onConfirm: (input: {
    pantryId: string;
    actualQuantity: number;
    actualUnitId?: string;
    storageState?: StorageState;
    expiresAt?: string;
    removeFromList: boolean;
    actualPrice?: number;
    notes?: string;
  }) => void;
}

export const MoveToPantryModal: React.FC<MoveToPantryModalProps> = ({
  visible,
  shoppingListItem,
  pantries,
  selectedPantryId,
  onClose,
  onConfirm,
}) => {
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      onDismiss: onClose,
      snapPoints: ['75%', '95%'],
      keyboardAware: true,
    });

  // Form state
  const [quantityInput, setQuantityInput] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [pantryId, setPantryId] = useState<string | null>(null);
  const [storageState, setStorageState] = useState<StorageState>(
    StorageState.Ambient,
  );
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(
    undefined,
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [removeFromList, setRemoveFromList] = useState(true);
  const [actualPriceInput, setActualPriceInput] = useState('');
  const [notes, setNotes] = useState('');

  // Reset form when modal opens with new item (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevShoppingListItem, setPrevShoppingListItem] =
    useState(shoppingListItem);
  const [prevSelectedPantryId, setPrevSelectedPantryId] =
    useState(selectedPantryId);
  if (
    visible !== prevVisible ||
    shoppingListItem !== prevShoppingListItem ||
    selectedPantryId !== prevSelectedPantryId
  ) {
    setPrevVisible(visible);
    setPrevShoppingListItem(shoppingListItem);
    setPrevSelectedPantryId(selectedPantryId);
    if (visible && shoppingListItem) {
      setQuantityInput(shoppingListItem.quantity?.toString() || '1');
      setUnitValue(
        shoppingListItem.unit?.symbol || shoppingListItem.unitName || '',
      );
      setUnitId(shoppingListItem.unit?.id || null);
      setPantryId(selectedPantryId);
      setStorageState(StorageState.Ambient);
      setExpirationDate(undefined);
      setShowDatePicker(false);
      setRemoveFromList(true);
      setActualPriceInput('');
      setNotes('');
    }
  }

  // Control bottom sheet visibility
  useEffect(() => {
    if (visible && shoppingListItem) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible, shoppingListItem, ref]);

  const handleConfirm = () => {
    if (!shoppingListItem) return;

    if (!pantryId) {
      alertService.alert('Error', 'Please select a pantry');
      return;
    }

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      alertService.alert('Error', 'Please enter a valid quantity');
      return;
    }

    // Validate unit is selected
    if (!unitId && !unitValue.trim()) {
      alertService.alert('Error', 'Please select a unit');
      return;
    }

    // Parse price value (optional)
    const actualPrice = actualPriceInput
      ? parseFloat(actualPriceInput)
      : undefined;

    onConfirm({
      pantryId,
      actualQuantity: quantityValue,
      actualUnitId: unitId || undefined,
      storageState,
      expiresAt: expirationDate?.toISOString(),
      removeFromList,
      actualPrice: isNaN(actualPrice!) ? undefined : actualPrice,
      notes: notes || undefined,
    });
    onClose();
  };

  const handleDateChange = (_event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setExpirationDate(date);
    }
  };

  const clearExpirationDate = () => {
    setExpirationDate(undefined);
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetFormScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Header
          title="Move to Pantry"
          centerTitle
          leftActions={[
            {
              icon: 'close',
              onPress: onClose,
            },
          ]}
          rightActions={[
            {
              icon: 'checkmark',
              onPress: handleConfirm,
            },
          ]}
        />

        {!!shoppingListItem && (
          <>
            {/* Item Info */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{shoppingListItem.itemName}</Text>
              <Text style={styles.itemQuantity}>
                Shopping list quantity: {shoppingListItem.quantity || 1}{' '}
                {shoppingListItem.unit?.symbol ||
                  shoppingListItem.unitName ||
                  ''}
              </Text>
            </View>

            {/* Pantry Selector */}
            {pantries.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  Select Pantry<Text style={styles.requiredAsterisk}> *</Text>
                </Text>
                <View style={styles.pantryList}>
                  {pantries.map(pantry => (
                    <Pressable
                      key={pantry.id}
                      style={({ pressed }) => [
                        styles.pantryOption,
                        pantryId === pantry.id && styles.pantryOptionActive,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => setPantryId(pantry.id)}
                    >
                      <Icon
                        name="cube-outline"
                        size={20}
                        color={
                          pantryId === pantry.id
                            ? theme.colors.white
                            : theme.colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.pantryOptionText,
                          pantryId === pantry.id &&
                            styles.pantryOptionTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {pantry.name}
                      </Text>
                      {!!pantry.isDefault && (
                        <View
                          style={[
                            styles.defaultBadge,
                            pantryId === pantry.id && styles.defaultBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.defaultBadgeText,
                              pantryId === pantry.id &&
                                styles.defaultBadgeTextActive,
                            ]}
                          >
                            Default
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Quantity and Unit Input */}
            <View style={styles.section}>
              <View style={styles.quantityUnitRow}>
                <View style={styles.quantityField}>
                  <FractionInput
                    label="Quantity"
                    value={quantityInput}
                    onChangeText={setQuantityInput}
                    placeholder="e.g., 1, 1 1/4"
                    keyboardType="numeric"
                    required
                  />
                </View>
                <View style={styles.unitField}>
                  <UnitAutocompleteField
                    variant="inline"
                    label="Unit"
                    value={unitValue}
                    onChangeText={setUnitValue}
                    placeholder="pcs, kg"
                    required
                    onUnitSelected={id => {
                      setUnitId(id);
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Storage State */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Storage Type</Text>
              <View style={styles.segmentedControl}>
                {STORAGE_STATES.map(state => (
                  <Pressable
                    key={state}
                    style={({ pressed }) => [
                      styles.segment,
                      storageState === state && styles.segmentActive,
                      pressed && styles.pressed,
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
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Expiration Date */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Expiration Date</Text>
              <View style={styles.dateRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.dateInput,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon
                    name="calendar-outline"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.dateText}>
                    {expirationDate
                      ? expirationDate.toLocaleDateString()
                      : 'Select date'}
                  </Text>
                </Pressable>
                {!!expirationDate && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.clearDateButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={clearExpirationDate}
                  >
                    <Icon
                      name="close"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
              {!!showDatePicker && (
                <DateTimePicker
                  value={expirationDate || new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              )}
            </View>

            {/* Purchase Price (Optional) */}
            <View style={styles.section}>
              <FormInput
                label="Purchase Price (per unit)"
                value={actualPriceInput}
                onChangeText={setActualPriceInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Notes (Optional) */}
            <View style={styles.section}>
              <FormInput
                label="Notes (Optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this purchase..."
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Remove from List Toggle */}
            <View style={styles.toggleSection}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>
                  Remove from shopping list
                </Text>
                <Text style={styles.toggleDescription}>
                  Turn off to keep the item in your shopping list
                </Text>
              </View>
              <Switch
                value={removeFromList}
                onValueChange={setRemoveFromList}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                thumbColor={theme.colors.white}
              />
            </View>
          </>
        )}
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  itemInfo: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
  },
  itemName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  itemQuantity: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  requiredAsterisk: {
    color: theme.colors.error,
  },
  quantityUnitRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  quantityField: {
    flex: 0.4,
  },
  unitField: {
    flex: 0.6,
    zIndex: 10,
  },
  pantryList: {
    gap: theme.spacing.sm,
  },
  pantryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    gap: theme.spacing.sm,
  },
  pantryOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pantryOptionText: {
    flex: 1,
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  pantryOptionTextActive: {
    color: theme.colors.white,
  },
  defaultBadge: {
    paddingVertical: theme.spacing.xs / 2,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.sm,
  },
  defaultBadgeActive: {
    backgroundColor: theme.colors.overlays.light,
  },
  defaultBadgeText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  defaultBadgeTextActive: {
    color: theme.colors.white,
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
  },
  dateText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.md,
  },
  clearDateButton: {
    padding: theme.spacing.sm,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
