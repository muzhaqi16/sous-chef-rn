import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FractionInput } from '#components/molecules/FractionInput';
import { Icon } from '#utils';
import { parseFractionalInput } from '#/utils';
import { StorageState, ShoppingListItemDisplayFragment, BasicPantryFragment } from '#generated';

const STORAGE_STATES = Object.values(StorageState);

interface MoveToPantryModalProps {
  visible: boolean;
  shoppingListItem: ShoppingListItemDisplayFragment | null;
  pantries: BasicPantryFragment[];
  selectedPantryId: string | null;
  onClose: () => void;
  onConfirm: (input: {
    pantryId: string;
    actualQuantity: number;
    storageState?: StorageState;
    expiresAt?: string;
    removeFromList: boolean;
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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  // Form state
  const [quantityInput, setQuantityInput] = useState('');
  const [pantryId, setPantryId] = useState<string | null>(null);
  const [storageState, setStorageState] = useState<StorageState>(StorageState.Ambient);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [removeFromList, setRemoveFromList] = useState(true);

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && shoppingListItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item
      setQuantityInput(shoppingListItem.quantity?.toString() || '1');
      setPantryId(selectedPantryId);
      setStorageState(StorageState.Ambient);
      setExpirationDate(undefined);
      setShowDatePicker(false);
      setRemoveFromList(true);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, shoppingListItem, selectedPantryId]);

  const handleConfirm = useCallback(() => {
    if (!shoppingListItem) return;

    if (!pantryId) {
      Alert.alert('Error', 'Please select a pantry');
      return;
    }

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    onConfirm({
      pantryId,
      actualQuantity: quantityValue,
      storageState,
      expiresAt: expirationDate?.toISOString(),
      removeFromList,
    });
    onClose();
  }, [shoppingListItem, pantryId, quantityInput, storageState, expirationDate, removeFromList, onConfirm, onClose]);

  const handleDateChange = useCallback((_event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setExpirationDate(date);
    }
  }, []);

  const clearExpirationDate = useCallback(() => {
    setExpirationDate(undefined);
  }, []);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['75%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
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
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Move to Pantry</Text>

        {shoppingListItem && (
          <>
            {/* Item Info */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{shoppingListItem.itemName}</Text>
              <Text style={styles.itemQuantity}>
                Shopping list quantity: {shoppingListItem.quantity || 1} {shoppingListItem.unit?.symbol || shoppingListItem.unitName || ''}
              </Text>
            </View>

            {/* Pantry Selector */}
            {pantries.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Select Pantry *</Text>
                <View style={styles.pantryList}>
                  {pantries.map(pantry => (
                    <TouchableOpacity
                      key={pantry.id}
                      style={[
                        styles.pantryOption,
                        pantryId === pantry.id && styles.pantryOptionActive,
                      ]}
                      onPress={() => setPantryId(pantry.id)}
                    >
                      <Icon
                        name="cupboard"
                        size={20}
                        color={pantryId === pantry.id ? theme.colors.white : theme.colors.textSecondary}
                        library="MaterialDesignIcons"
                      />
                      <Text
                        style={[
                          styles.pantryOptionText,
                          pantryId === pantry.id && styles.pantryOptionTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {pantry.name}
                      </Text>
                      {pantry.isDefault && (
                        <View style={[
                          styles.defaultBadge,
                          pantryId === pantry.id && styles.defaultBadgeActive,
                        ]}>
                          <Text style={[
                            styles.defaultBadgeText,
                            pantryId === pantry.id && styles.defaultBadgeTextActive,
                          ]}>
                            Default
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Quantity Input */}
            <View style={styles.section}>
              <FractionInput
                label={`Actual Quantity Purchased (${shoppingListItem.unit?.symbol || shoppingListItem.unitName || 'item'}) *`}
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder="e.g., 1, 1 1/4, or 1.5"
                keyboardType="numeric"
              />
            </View>

            {/* Storage State */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Storage Type</Text>
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

            {/* Expiration Date */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Expiration Date (Optional)</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="event" size={20} color={theme.colors.textSecondary} />
                  <Text style={styles.dateText}>
                    {expirationDate
                      ? expirationDate.toLocaleDateString()
                      : 'Select date'}
                  </Text>
                </TouchableOpacity>
                {expirationDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={clearExpirationDate}
                  >
                    <Icon name="close" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={expirationDate || new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              )}
            </View>

            {/* Remove from List Toggle */}
            <View style={styles.toggleSection}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Remove from shopping list</Text>
                <Text style={styles.toggleDescription}>
                  Turn off to keep the item in your shopping list
                </Text>
              </View>
              <Switch
                value={removeFromList}
                onValueChange={setRemoveFromList}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Add to Pantry</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  itemInfo: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
  actions: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
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
