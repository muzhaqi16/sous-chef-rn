import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { SheetFormHeader } from '#components/molecules/SheetFormHeader';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { CategoryAutocompleteField } from '#components/molecules/AutocompleteField/CategoryAutocompleteField';
import { BrandAutocompleteField } from '#components/molecules/AutocompleteField/BrandAutocompleteField';
import { StoreAutocompleteField } from '#components/molecules/AutocompleteField/StoreAutocompleteField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { CategoryType } from '#/graphql/generated/schemaTypes';
import {
  PRIORITY_OPTIONS,
  PRIORITY_VALUES,
  PRIORITY_OPTION_BY_VALUE,
  priorityLabelKey,
} from '#features/shoppingList/utils/priority';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import { useAddShoppingItem } from '#features/shoppingList/hooks/mutations/useAddShoppingItem';
import { alertService } from '#/services/alertService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { handleMutationError } from '#/utils/errorHandlers';
import { makeIdNameHandler } from '../makeIdNameHandler';
import { localizeNumericHint } from '#/utils/formatters/number';

interface ShoppingListDetailsStepProps {
  shoppingListId: string | undefined;
  prefilledItemName?: string;
  /** Refetch used by the add hook's cache-update fallback (suggestions list). */
  refetch: () => Promise<unknown>;
  /** Return to the search step of the parent sheet. */
  onClose: () => void;
  /** Item was created — the parent closes the whole sheet. */
  onSuccess: () => void;
}

/**
 * In-place "details" step for the Add to Shopping List sheet.
 *
 * Rendered as content INSIDE the shared AddItemSheet (not its own modal) when
 * the user taps "Add manually", so the search → form transition is a single
 * morphing sheet — the same pattern the pantry flow uses. Reuses the shared
 * `useShoppingListItemForm` state and the bottom-sheet-aware autocomplete
 * fields; the offline-first create goes through the shared `useAddShoppingItem`.
 *
 * The item name is a plain field here, not a catalog picker: the user reached
 * this step by choosing "Add manually" under the search step's own catalog
 * matches, and the add never linked a catalog item from this form anyway
 * (`useAddShoppingItem` posts `item: { itemName }`).
 */
export const ShoppingListDetailsStep: React.FC<
  ShoppingListDetailsStepProps
> = ({
  shoppingListId,
  prefilledItemName = '',
  refetch,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Mounted fresh each time the user enters the details step, so the form
  // initializes straight from props.
  const {
    formState: {
      itemName,
      quantityInput,
      unit,
      notes,
      category,
      estimatedPrice,
      brand,
      brandId,
      netWeight,
      netWeightUnit,
      netWeightUnitId,
      priority,
      storeId,
      storeName,
    },
    updateField,
    buildUnitInput,
    parseNetWeightInput,
    netWeightNeedsUnit,
  } = useShoppingListItemForm({ itemName: prefilledItemName });

  const { addItem } = useAddShoppingItem({ listId: shoppingListId, refetch });
  const [saving, setSaving] = useState(false);

  const handleUnitSelect = (unitId: string | null) => {
    updateField('selectedUnitId', unitId);
  };

  const handleBrandSelected = makeIdNameHandler(
    id => updateField('brandId', id),
    name => updateField('brand', name),
  );
  // Not `makeIdNameHandler`: that writes the display NAME, and
  // `UnitAutocompleteField` has already written the symbol through
  // `onChangeText`. Writing the name back turns "g" into "gram". The handler is
  // still the right one for brand and store, where the name IS the display
  // value.
  const handleNetWeightUnitSelected = (id: string | null) => {
    updateField('netWeightUnitId', id);
  };
  const handleStoreSelected = makeIdNameHandler(
    id => updateField('storeId', id),
    name => updateField('storeName', name),
  );

  const formatPriorityLabel = (option: string) => t(priorityLabelKey(option));

  const handleSave = () => {
    if (!itemName.trim()) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.pleaseEnterItemName'),
      );
      return;
    }
    if (!quantityInput.trim()) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.pleaseEnterQuantity'),
      );
      return;
    }
    // Net weight is all-or-nothing — a value without a unit is rejected by the
    // API, so prompt for a unit instead of silently dropping it.
    if (netWeightNeedsUnit) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.netWeightUnitRequired'),
      );
      return;
    }

    const unitData = buildUnitInput();
    const netWeightValue = parseNetWeightInput();
    executeWithLoadingState(
      async () => {
        await addItem({
          itemName,
          quantityInput,
          unitName: unit || undefined,
          unitId:
            'unit' in unitData ? unitData.unit.unitId ?? undefined : undefined,
          notes: notes || undefined,
          category: category || undefined,
          estimatedPrice: estimatedPrice || undefined,
          brandName: brand.trim() || undefined,
          brandId: brandId ?? undefined,
          // Both or neither — `netWeightNeedsUnit` was checked above.
          netWeight:
            netWeightValue !== undefined && netWeightUnitId
              ? netWeightValue
              : undefined,
          netWeightUnitId:
            netWeightValue !== undefined
              ? netWeightUnitId ?? undefined
              : undefined,
          priority,
          preferredStoreId: storeId ?? undefined,
        });
        onSuccess();
      },
      setSaving,
      (error: unknown) =>
        handleMutationError(error, { operation: 'ShoppingListItem.add' }),
    );
  };

  return (
    <View style={styles.container} testID="add-shopping-item-details">
      <SheetFormHeader
        title={t('shoppingListScreens.addItem')}
        cancelLabel={t('labels.cancel')}
        saveLabel={t('labels.add')}
        onCancel={onClose}
        onSave={handleSave}
        saving={saving}
        submitTestID="add-shopping-item-submit-button"
      />

      <BottomSheetFormScrollView
        // Named so a test can scroll a field into view. The unit picker sits in
        // the second `FieldRow`, below the fold once the keyboard is up, and
        // Detox refuses to type into a view that is not hittable.
        testID="add-shopping-item-scroll"
        style={styles.body}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plain field, as on the pantry details page: the search step
            already showed catalog matches for this text, and a picker here
            only ever pre-filled unit and category — it never linked the item. */}
        <FormInput
          label={t('shoppingListScreens.itemName')}
          required
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          placeholder={t('shoppingListScreens.itemNamePlaceholder')}
          useBottomSheetInput
          testID="add-shopping-item-name-input"
        />

        <BrandAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.brand')}
          value={brand}
          onChangeText={text => updateField('brand', text)}
          onBrandSelected={handleBrandSelected}
          placeholder={t('shoppingListScreens.brandPlaceholder')}
        />

        <CategoryAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.category')}
          value={category}
          onChangeText={text => updateField('category', text)}
          placeholder={t('shoppingListScreens.categoryPlaceholder')}
          categoryType={CategoryType.General}
        />

        <FieldRow>
          <EditableCounter
            label={t('shoppingListScreens.quantity')}
            required
            value={quantityInput}
            onChangeText={text => updateField('quantityInput', text)}
            placeholder="1"
            testID="add-shopping-item-quantity-input"
          />
          <UnitAutocompleteField
            variant="modal"
            label={t('shoppingListScreens.unit')}
            value={unit}
            onChangeText={text => updateField('unit', text)}
            onUnitSelected={handleUnitSelect}
            placeholder={t('shoppingListScreens.unitPlaceholder')}
            testID="add-shopping-item-unit-picker"
          />
        </FieldRow>

        <FieldRow>
          <FormInput
            label={t('shoppingListScreens.netWeight')}
            value={netWeight}
            onChangeText={text => updateField('netWeight', text)}
            placeholder={t('shoppingListScreens.netWeightPlaceholder')}
            keyboardType="decimal-pad"
            useBottomSheetInput
          />
          <UnitAutocompleteField
            variant="modal"
            label={t('shoppingListScreens.netWeightUnit')}
            value={netWeightUnit}
            onChangeText={text => updateField('netWeightUnit', text)}
            onUnitSelected={handleNetWeightUnitSelected}
            placeholder={t('shoppingListScreens.unitPlaceholder')}
          />
        </FieldRow>

        <FormInput
          label={t('shoppingListScreens.estimatedPrice')}
          value={estimatedPrice}
          onChangeText={text => updateField('estimatedPrice', text)}
          placeholder={localizeNumericHint(
            t('shoppingListScreens.estimatedPricePlaceholder'),
          )}
          keyboardType="numeric"
          useBottomSheetInput
        />

        <SegmentedControl
          label={t('shoppingListScreens.priority')}
          options={PRIORITY_OPTIONS}
          value={PRIORITY_OPTION_BY_VALUE[priority] ?? 'low'}
          onChange={option =>
            updateField('priority', PRIORITY_VALUES[option] ?? 0)
          }
          formatLabel={formatPriorityLabel}
        />

        <StoreAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.store')}
          value={storeName}
          onChangeText={text => updateField('storeName', text)}
          onStoreSelected={handleStoreSelected}
          placeholder={t('shoppingListScreens.storePlaceholder')}
          helperText={t('labels.storeSelectHint')}
        />

        <FormInput
          label={t('shoppingListScreens.notes')}
          value={notes}
          onChangeText={text => updateField('notes', text)}
          placeholder={t('shoppingListScreens.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </BottomSheetFormScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
}));
