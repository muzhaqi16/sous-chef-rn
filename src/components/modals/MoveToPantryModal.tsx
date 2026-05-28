import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFragment } from '@apollo/client/react';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { Header } from '#components/molecules/Header';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { Icon } from '#utils/iconUtils';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Text } from '#components/atoms/Text';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { MoveToPantryModal_ShoppingListItemFragmentDoc } from './MoveToPantryModal.generated';

const STORAGE_STATES = Object.values(StorageState);

interface MoveToPantryModalProps {
  visible: boolean;
  shoppingListItemId: string | null;
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
  shoppingListItemId,
  pantries,
  selectedPantryId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const { data, complete } = useFragment({
    fragment: MoveToPantryModal_ShoppingListItemFragmentDoc,
    fragmentName: 'MoveToPantryModal_shoppingListItem',
    from: shoppingListItemId
      ? { __typename: 'ShoppingListItem', id: shoppingListItemId }
      : null,
  });
  const shoppingListItem = shoppingListItemId && complete ? data : null;

  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!shoppingListItem,
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

  // Reset form when modal opens with new item (render-time state update).
  // Key on the item id (not the materialized object) so cache updates to the
  // same item don't clobber input.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevShoppingListItemId, setPrevShoppingListItemId] = useState(
    shoppingListItem?.id,
  );
  const [prevSelectedPantryId, setPrevSelectedPantryId] =
    useState(selectedPantryId);
  if (
    visible !== prevVisible ||
    shoppingListItem?.id !== prevShoppingListItemId ||
    selectedPantryId !== prevSelectedPantryId
  ) {
    setPrevVisible(visible);
    setPrevShoppingListItemId(shoppingListItem?.id);
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

  const handleConfirm = () => {
    if (!shoppingListItem) return;

    if (!pantryId) {
      alertService.alert(
        t('labels.error'),
        t('moveToPantry.selectPantryError'),
      );
      return;
    }

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      alertService.alert(t('labels.error'), t('moveToPantry.invalidQuantity'));
      return;
    }

    // Validate unit is selected
    if (!unitId && !unitValue.trim()) {
      alertService.alert(t('labels.error'), t('moveToPantry.selectUnitError'));
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

  const storageStateLabel: Record<StorageState, string> = {
    [StorageState.Ambient]: t('moveToPantry.stateAmbient'),
    [StorageState.Refrigerated]: t('moveToPantry.stateRefrigerated'),
    [StorageState.Frozen]: t('moveToPantry.stateFrozen'),
    [StorageState.None]: '',
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
          title={t('moveToPantry.title')}
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
              <Text size="lg" weight="semibold" style={styles.itemName}>
                {shoppingListItem.itemName}
              </Text>
              <Text size="base" tone="secondary">
                {t('moveToPantry.shoppingListQuantityPrefix')}
                {shoppingListItem.quantity || 1}{' '}
                {shoppingListItem.unit?.symbol ||
                  shoppingListItem.unitName ||
                  ''}
              </Text>
            </View>

            {/* Pantry Selector */}
            {pantries.length > 0 && (
              <View style={styles.section}>
                <Text size="md" weight="medium" style={styles.sectionLabel}>
                  {t('moveToPantry.selectPantry')}
                  <Text tone="error">{t('moveToPantry.requiredAsterisk')}</Text>
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
                        tone={
                          pantryId === pantry.id ? 'white' : 'textSecondary'
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
                            {t('moveToPantry.defaultLabel')}
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
                    label={t('moveToPantry.quantity')}
                    value={quantityInput}
                    onChangeText={setQuantityInput}
                    placeholder={t('moveToPantry.quantityPlaceholder')}
                    keyboardType="numeric"
                    required
                  />
                </View>
                <View style={styles.unitField}>
                  <UnitAutocompleteField
                    variant="inline"
                    label={t('moveToPantry.unit')}
                    value={unitValue}
                    onChangeText={setUnitValue}
                    placeholder={t('moveToPantry.unitPlaceholder')}
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
              <Text size="md" weight="medium" style={styles.sectionLabel}>
                {t('moveToPantry.storageType')}
              </Text>
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
                      {storageStateLabel[state]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Expiration Date */}
            <View style={styles.section}>
              <Text size="md" weight="medium" style={styles.sectionLabel}>
                {t('moveToPantry.expirationDate')}
              </Text>
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
                    tone="textSecondary"
                  />
                  <Text style={styles.dateText}>
                    {expirationDate
                      ? expirationDate.toLocaleDateString()
                      : t('moveToPantry.selectDate')}
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
                    <Icon name="close" size={20} tone="textSecondary" />
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
                label={t('moveToPantry.purchasePrice')}
                value={actualPriceInput}
                onChangeText={setActualPriceInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Notes (Optional) */}
            <View style={styles.section}>
              <FormInput
                label={t('moveToPantry.notesOptional')}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('moveToPantry.notesPlaceholder')}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Remove from List Toggle */}
            <View style={styles.toggleSection}>
              <View style={styles.toggleInfo}>
                <Text size="base" weight="medium">
                  {t('moveToPantry.removeFromShopping')}
                </Text>
                <Text
                  size="sm"
                  tone="secondary"
                  style={styles.toggleDescription}
                >
                  {t('moveToPantry.removeFromShoppingDesc')}
                </Text>
              </View>
              <BaseSwitch
                value={removeFromList}
                onValueChange={setRemoveFromList}
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
    marginBottom: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
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
  toggleDescription: {
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
