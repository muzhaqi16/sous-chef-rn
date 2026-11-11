import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { FormInput } from '#components/atoms/FormInput';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { CategoryAutocompleteField } from '#features/catalog/ui/autocomplete/CategoryAutocompleteField';
import { BrandAutocompleteField } from '#features/catalog/ui/autocomplete/BrandAutocompleteField';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/atoms/FieldRow';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { CategoryType } from '#/graphql/generated/schemaTypes';
import {
  PRIORITY_OPTIONS,
  priorityValueOf,
  priorityOptionOf,
  priorityLabelKey,
} from '#features/shoppingList/utils/priority';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import { useAddShoppingItem } from '#features/shoppingList/hooks/mutations/useAddShoppingItem';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { alertService } from '#/services/alertService';
import { localizeNumericHint } from '#/utils/formatters/number';
import { reportValidationErrors } from '#/utils/validation/common';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useDiscardGuard } from '#hooks/ui/useDiscardGuard';

interface ShoppingListDetailsStepProps {
  shoppingListId: string | undefined;
  prefilledItemName?: string;
  /** Refetch used by the add hook's cache-update fallback (suggestions list). */
  /** Return to the search step of the parent sheet. */
  onClose: () => void;
  /** Item was created — the parent closes the whole sheet. */
  onSuccess: () => void;
  /** Holds the parent sheet open against a pan-down while input would be lost. */
  onHoldOpen?: (held: boolean) => void;
}

/**
 * The "details" step, rendered INSIDE the shared AddItemSheet so search → form is
 * one morphing sheet. The name is a plain field, not a catalog picker:
 * `useAddShoppingItem` sends it `inline`, under a minted item id.
 */
export const ShoppingListDetailsStep: React.FC<
  ShoppingListDetailsStepProps
> = ({
  shoppingListId,
  prefilledItemName = '',
  onClose,
  onSuccess,
  onHoldOpen,
}) => {
  const { t } = useTranslation();
  // Off, the line is added with no price.
  const showPrices = useBudgetAndPricesEnabled();
  const insets = useSafeAreaInsets();

  // Mounted fresh each time the user enters the details step, so the form
  // initializes straight from props.
  const {
    control,
    handleSubmit,
    setFocus,
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
      netWeightUnitId,
      priority,
      storeId,
      storeName,
    },
    setFieldValue,
    buildUnitInput,
    parseNetWeightInput,
    hasDirtyFields,
  } = useShoppingListItemForm({ itemName: prefilledItemName });

  const handleCancel = useDiscardGuard({
    isDirty: hasDirtyFields,
    onDiscard: onClose,
    onHoldOpen,
  });

  // The typed fields render through `Controller`, so react-hook-form holds
  // their inputs: the return key moves on by name, and a failed submit focuses
  // the first field in error.
  const afterNetWeight = showPrices ? 'estimatedPrice' : 'notes';

  const { addItem } = useAddShoppingItem({ listId: shoppingListId });
  const [saving, setSaving] = useState(false);

  const handleUnitSelect = (unitId: string | null) => {
    setFieldValue('selectedUnitId', unitId);
  };

  // Each picker has handed its pick over as text; the form keeps its id.
  const handleBrandSelected = (id: string | null) => {
    setFieldValue('brandId', id);
  };
  const handleNetWeightUnitSelected = (id: string | null) => {
    setFieldValue('netWeightUnitId', id);
  };
  const handleStoreSelected = (id: string | null) => {
    setFieldValue('storeId', id);
  };

  // `handleSubmit` runs the schema first and only calls this on a valid form;
  // an invalid one renders its message on the offending field instead.
  const handleSave = handleSubmit(() => {
    const unitData = buildUnitInput();
    const netWeightValue = parseNetWeightInput();
    void executeWithLoadingState(
      async () => {
        const added = await addItem({
          itemName,
          quantityInput,
          unitName: unit || undefined,
          unitId: unitData.unit?.id ?? undefined,
          notes: notes || undefined,
          category: category || undefined,
          estimatedPrice: (showPrices && estimatedPrice) || undefined,
          brandName: brand.trim() || undefined,
          brandId: brandId ?? undefined,
          // The add sends a weight only with its unit, and the schema
          // refuses either without the other.
          netWeight: netWeightValue,
          netWeightUnitId: netWeightUnitId ?? undefined,
          priority,
          preferredStoreId: storeId ?? undefined,
        });
        // A refusal was alerted by the hook; the form stays open with its input.
        if (added) onSuccess();
      },
      setSaving,
      () => alertService.alert(t('labels.error'), t('errors.addItemFailed')),
    );
  }, reportValidationErrors);

  return (
    <View style={styles.container} testID={shoppingListTestIDs.addSheetDetails}>
      <BottomSheetHeader
        title={t('labels.addItem')}
        cancelLabel={t('labels.cancel')}
        confirmLabel={t('labels.add')}
        onCancel={handleCancel}
        onConfirm={handleSave}
        saving={saving}
        cancelTestID={shoppingListTestIDs.addSheetCancelButton}
        confirmTestID={shoppingListTestIDs.addSheetSubmitButton}
        titleTestID={shoppingListTestIDs.addSheetTitle}
      />

      <BottomSheetFormScrollView
        // Named so a test can scroll a field into view. The unit picker sits in
        // the second `FieldRow`, below the fold once the keyboard is up, and
        // Detox refuses to type into a view that is not hittable.
        testID={shoppingListTestIDs.addSheetScroll}
        style={styles.body}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plain field: the search step already showed the catalog matches. */}
        <Controller
          control={control}
          name="itemName"
          render={({ field: { value, onChange, ref } }) => (
            <FormInput
              label={t('labels.itemName')}
              required
              error={errors.itemName?.message}
              value={value}
              onChangeText={onChange}
              placeholder={t('shoppingListScreens.itemNamePlaceholder')}
              useBottomSheetInput
              ref={ref}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => setFocus('quantityInput')}
              testID={shoppingListTestIDs.addSheetNameInput}
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
            render={({ field: { value, onChange, ref } }) => (
              <EditableCounter
                label={t('labels.quantity')}
                required
                error={errors.quantityInput?.message}
                value={value}
                onChangeText={onChange}
                placeholder="1"
                ref={ref}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => setFocus('netWeight')}
                testID={shoppingListTestIDs.addSheetQuantityInput}
              />
            )}
          />
          <UnitAutocompleteField
            variant="modal"
            label={t('labels.unit')}
            value={unit}
            onChangeText={text => setFieldValue('unit', text)}
            onUnitSelected={handleUnitSelect}
            placeholder={t('labels.pcsKgEtc')}
            testID={shoppingListTestIDs.addSheetUnitPicker}
          />
        </FieldRow>

        <FieldRow>
          <Controller
            control={control}
            name="netWeight"
            // The all-or-nothing rule lives on `netWeightUnit`; it re-runs as
            // the weight is typed.
            rules={{ deps: ['netWeightUnit'] }}
            render={({ field: { value, onChange, ref } }) => (
              <FormInput
                label={t('labels.netWeight')}
                value={value}
                onChangeText={onChange}
                // The rule reports on BOTH halves of the pair.
                error={errors.netWeight?.message}
                placeholder={t('shoppingListScreens.netWeightPlaceholder')}
                keyboardType="decimal-pad"
                useBottomSheetInput
                ref={ref}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => setFocus(afterNetWeight)}
              />
            )}
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

        {showPrices ? (
          <Controller
            control={control}
            name="estimatedPrice"
            render={({ field: { value, onChange, ref } }) => (
              <FormInput
                label={t('shoppingListScreens.estimatedPrice')}
                value={value}
                onChangeText={onChange}
                error={errors.estimatedPrice?.message}
                placeholder={localizeNumericHint(
                  t('shoppingListScreens.estimatedPricePlaceholder'),
                )}
                keyboardType="numeric"
                useBottomSheetInput
                ref={ref}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => setFocus('notes')}
              />
            )}
          />
        ) : null}

        <SegmentedControl
          label={t('shoppingListScreens.priority')}
          options={PRIORITY_OPTIONS}
          value={priorityOptionOf(priority) ?? 'low'}
          onChange={option =>
            setFieldValue('priority', priorityValueOf(option))
          }
          formatLabel={option => t(priorityLabelKey(option))}
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

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, ref } }) => (
            <FormInput
              label={t('labels.notes')}
              value={value}
              onChangeText={onChange}
              placeholder={t('shoppingListScreens.notesPlaceholder')}
              multiline
              numberOfLines={3}
              useBottomSheetInput
              ref={ref}
            />
          )}
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
