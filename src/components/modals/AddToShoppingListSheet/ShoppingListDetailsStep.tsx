import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
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
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { handleMutationError } from '#/utils/errorHandlers';
import { makeIdNameHandler } from '../makeIdNameHandler';
import { localizeNumericHint } from '#/utils/formatters/number';
import { logValidationErrors } from '#/utils/validation/common';

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
    control,
    handleSubmit,
    errors,
    values: {
      itemName,
      quantityInput,
      unit,
      notes,
      category,
      estimatedPrice,
      brand,
      brandId,
      netWeight,
      netWeightUnitId,
      priority,
      storeId,
      storeName,
    },
    setFieldValue,
    buildUnitInput,
    parseNetWeightInput,
  } = useShoppingListItemForm({ itemName: prefilledItemName });

  const { addItem } = useAddShoppingItem({ listId: shoppingListId, refetch });
  const [saving, setSaving] = useState(false);

  const handleUnitSelect = (unitId: string | null) => {
    setFieldValue('selectedUnitId', unitId);
  };

  const handleBrandSelected = makeIdNameHandler(
    id => setFieldValue('brandId', id),
    name => setFieldValue('brand', name),
  );
  // Not `makeIdNameHandler`: that writes the display NAME, and
  // `UnitAutocompleteField` has already written the symbol through
  // `onChangeText`. Writing the name back turns "g" into "gram". The handler is
  // still the right one for brand and store, where the name IS the display
  // value.
  const handleNetWeightUnitSelected = (id: string | null) => {
    setFieldValue('netWeightUnitId', id);
  };
  const handleStoreSelected = makeIdNameHandler(
    id => setFieldValue('storeId', id),
    name => setFieldValue('storeName', name),
  );

  const formatPriorityLabel = (option: string) => t(priorityLabelKey(option));

  // `handleSubmit` runs the schema first and only calls this on a valid form;
  // an invalid one renders its message on the offending field instead.
  const handleSave = handleSubmit(() => {
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
  }, logValidationErrors);

  return (
    <View style={styles.container} testID="add-shopping-item-details">
      <SheetFormHeader
        title={t('labels.addItem')}
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
        <Controller
          control={control}
          name="itemName"
          render={({ field: { value, onChange } }) => (
            <FormInput
              label={t('labels.itemName')}
              required
              error={errors.itemName?.message}
              value={value}
              onChangeText={onChange}
              placeholder={t('shoppingListScreens.itemNamePlaceholder')}
              useBottomSheetInput
              testID="add-shopping-item-name-input"
            />
          )}
        />

        <BrandAutocompleteField
          variant="modal"
          label={t('labels.brand')}
          value={brand}
          onChangeText={text => setFieldValue('brand', text)}
          onBrandSelected={handleBrandSelected}
          placeholder={t('shoppingListScreens.brandPlaceholder')}
        />

        <CategoryAutocompleteField
          variant="modal"
          label={t('labels.category')}
          value={category}
          onChangeText={text => setFieldValue('category', text)}
          placeholder={t('labels.eGDairyProduce')}
          categoryType={CategoryType.General}
        />

        <FieldRow>
          <Controller
            control={control}
            name="quantityInput"
            render={({ field: { value, onChange } }) => (
              <EditableCounter
                label={t('labels.quantity')}
                required
                error={errors.quantityInput?.message}
                value={value}
                onChangeText={onChange}
                placeholder="1"
                testID="add-shopping-item-quantity-input"
              />
            )}
          />
          <UnitAutocompleteField
            variant="modal"
            label={t('storageLocationForm.unit')}
            value={unit}
            onChangeText={text => setFieldValue('unit', text)}
            onUnitSelected={handleUnitSelect}
            placeholder={t('labels.pcsKgEtc')}
            testID="add-shopping-item-unit-picker"
          />
        </FieldRow>

        <FieldRow>
          <FormInput
            label={t('labels.netWeight')}
            value={netWeight}
            onChangeText={text => setFieldValue('netWeight', text)}
            placeholder={t('shoppingListScreens.netWeightPlaceholder')}
            keyboardType="decimal-pad"
            useBottomSheetInput
          />
          <Controller
            control={control}
            name="netWeightUnit"
            render={({ field: { value, onChange } }) => (
              <UnitAutocompleteField
                variant="modal"
                label={t('labels.weightUnit')}
                error={errors.netWeightUnit?.message}
                value={value}
                onChangeText={onChange}
                onUnitSelected={handleNetWeightUnitSelected}
                placeholder={t('labels.pcsKgEtc')}
              />
            )}
          />
        </FieldRow>

        <FormInput
          label={t('shoppingListScreens.estimatedPrice')}
          value={estimatedPrice}
          onChangeText={text => setFieldValue('estimatedPrice', text)}
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
            setFieldValue('priority', PRIORITY_VALUES[option] ?? 0)
          }
          formatLabel={formatPriorityLabel}
        />

        <StoreAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.store')}
          value={storeName}
          onChangeText={text => setFieldValue('storeName', text)}
          onStoreSelected={handleStoreSelected}
          placeholder={t('shoppingListScreens.storePlaceholder')}
          helperText={t('labels.storeSelectHint')}
        />

        <FormInput
          label={t('shoppingListScreens.notes')}
          value={notes}
          onChangeText={text => setFieldValue('notes', text)}
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
