import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFragment } from '@apollo/client/react';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { Header } from '#components/molecules/Header';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Text } from '#components/atoms/Text';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { MoveToPantryModal_ShoppingListItemFragmentDoc } from './MoveToPantryModal.generated';
import { PantrySelector } from './moveToPantry/PantrySelector';
import { StorageStateControl } from './moveToPantry/StorageStateControl';
import { ExpirationDateField } from './moveToPantry/ExpirationDateField';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';

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
  /** Server unreachable (offline / API down) — disables the confirm action. */
  confirmDisabled?: boolean;
}

export const MoveToPantryModal: React.FC<MoveToPantryModalProps> = ({
  visible,
  shoppingListItemId,
  pantries,
  selectedPantryId,
  onClose,
  onConfirm,
  confirmDisabled = false,
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
      setQuantityInput(formatNumberForInput(shoppingListItem.quantity) || '1');
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
      ? parseDecimalInput(actualPriceInput)
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

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
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
              disabled: confirmDisabled,
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
            <PantrySelector
              pantries={pantries}
              selectedPantryId={pantryId}
              onSelect={setPantryId}
            />

            {/* Quantity and Unit Input */}
            <DropdownStack>
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
              <StorageStateControl
                value={storageState}
                onChange={setStorageState}
              />

              {/* Expiration Date */}
              <ExpirationDateField
                expirationDate={expirationDate}
                showPicker={showDatePicker}
                onOpenPicker={() => setShowDatePicker(true)}
                onChange={handleDateChange}
                onClear={clearExpirationDate}
              />

              {/* Purchase Price (Optional) */}
              <View style={styles.section}>
                <FormInput
                  label={t('moveToPantry.purchasePrice')}
                  value={actualPriceInput}
                  onChangeText={setActualPriceInput}
                  placeholder={localizeNumericHint('0.00')}
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
            </DropdownStack>
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
    borderCurve: 'continuous',
  },
  itemName: {
    marginBottom: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.lg,
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
    borderCurve: 'continuous',
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleDescription: {
    marginTop: theme.spacing.xs,
  },
}));
