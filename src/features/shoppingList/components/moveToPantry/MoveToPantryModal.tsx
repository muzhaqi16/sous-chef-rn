import React from 'react';
import { View } from 'react-native';
import { useMoney } from '#domain/money';
import { useTranslation } from '#i18n';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import { formatQuantityForDisplay } from '#utils/formatQuantity';
import { Text } from '#components/atoms/Text';
import type { MoveToPantryInput } from '#features/shoppingList/hooks/useMoveToPantry';
import { useMoveToPantryItem } from '#features/shoppingList/components/moveToPantry/useMoveToPantryItem';
import { PantrySelector } from './PantrySelector';
import { StorageStateControl } from './StorageStateControl';
import { localizeNumericHint } from '#utils/formatters/number';
import { PerUnitHint } from '#features/shoppingList/components/PerUnitHint';
import { Sheet } from '#components/templates/Sheet';
import { Controller } from 'react-hook-form';
import type { MoveTarget } from '#features/shoppingList/utils/moveTargets';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import {
  useMoveToPantryForm,
  type LoadedMoveItem,
} from './useMoveToPantryForm';

interface MoveToPantryModalProps {
  visible: boolean;
  shoppingListItemId: string | null;
  pantries: readonly MoveTarget[];
  /** Stands in for the pantry choice when the read behind it failed. */
  pantriesUnavailable?: React.ReactNode;
  selectedPantryId: string | null;
  onClose: () => void;
  /** Resolves true once the move is applied or queued; a refusal keeps the sheet open. */
  onConfirm: (input: MoveToPantryInput) => Promise<boolean>;
  /** Server unreachable (offline / API down) — disables the confirm action. */
  confirmDisabled?: boolean;
  /** False leaves out the amount paid, and the move records no price. */
  askPrice?: boolean;
}

type MoveToPantryFormProps = Omit<
  MoveToPantryModalProps,
  'visible' | 'shoppingListItemId'
> & { moveItem: LoadedMoveItem };

/** One opening of the move, its fields driven by `useMoveToPantryForm`. */
const MoveToPantryForm: React.FC<MoveToPantryFormProps> = ({
  moveItem,
  pantries,
  pantriesUnavailable,
  selectedPantryId,
  onClose,
  onConfirm,
  confirmDisabled = false,
  askPrice = true,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const { shoppingListItem, purchasedQuantity } = moveItem;
  const form = useMoveToPantryForm({
    moveItem,
    selectedPantryId,
    askPrice,
    onConfirm,
    onClose,
  });
  const { control, errors, lineUnitLabel } = form;

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('moveToPantry.title')}
          onClose={onClose}
          confirm={{
            accessibilityLabel: t('moveToPantry.title'),
            onPress: form.submit,
            disabled: confirmDisabled,
            loading: form.isMoving,
            testID: shoppingListTestIDs.moveToPantryConfirm,
          }}
        />
      </SheetHeaderSlot>
      {/* Item Info */}
      <View style={styles.itemInfo}>
        <Text role="heading" style={styles.itemName}>
          {shoppingListItem.itemName}
        </Text>
        <Text role="body" tone="secondary">
          {purchasedQuantity != null
            ? t('moveToPantry.purchasedAmount', {
                amount: formatQuantityForDisplay(purchasedQuantity),
                unit: lineUnitLabel,
              })
            : t('moveToPantry.requestedAmount', {
                // A missing or zero requested quantity reads as one.
                amount: formatQuantityForDisplay(
                  (shoppingListItem.quantity ?? 0) || 1,
                ),
                unit: lineUnitLabel,
              })}
        </Text>
      </View>

      {/* Pantry Selector */}
      {pantriesUnavailable}
      <PantrySelector
        pantries={pantries}
        selectedPantryId={form.pantryId}
        onSelect={form.selectPantry}
        error={errors.pantryId?.message}
      />

      {/* Quantity and Unit Input */}
      <DropdownStack>
        <View style={styles.section}>
          <View style={styles.quantityUnitRow}>
            <View style={styles.quantityField}>
              <FractionInput
                label={t('labels.quantity')}
                value={form.quantityInput}
                onChangeText={form.changeQuantity}
                placeholder={t('labels.eG1114')}
                required
                error={errors.quantityInput?.message}
              />
            </View>
            <View style={styles.unitField}>
              <UnitAutocompleteField
                variant="inline"
                label={t('labels.unit')}
                value={form.unitValue}
                onChangeText={form.changeUnitText}
                placeholder={t('moveToPantry.unitPlaceholder')}
                required
                error={errors.unitValue?.message}
                onUnitSelected={(picked, _name, pickedType) =>
                  form.selectUnit(picked, pickedType)
                }
              />
            </View>
          </View>
        </View>

        {/* Package size (Optional) */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="packageSizeInput"
            render={({ field: size, fieldState: sizeState }) => (
              <Controller
                control={control}
                name="packageSizeUnitValue"
                render={({ field: unit, fieldState: unitState }) => (
                  <PackageContentsFields
                    variant="inline"
                    size={size.value}
                    onSizeChange={text => {
                      size.onChange(text);
                      form.sizeChanged();
                    }}
                    sizeError={sizeState.error?.message}
                    unit={unit.value}
                    onUnitChange={unit.onChange}
                    unitError={unitState.error?.message}
                    unitTestID={shoppingListTestIDs.moveToPantryPackageSizeUnit}
                    onUnitSelected={(picked, _name, pickedType) =>
                      form.selectSizeUnit(picked, pickedType)
                    }
                  />
                )}
              />
            )}
          />
          <Text role="caption" tone="secondary" style={styles.perUnitHint}>
            {t('moveToPantry.packageSizeHint')}
          </Text>
        </View>

        {/* Storage State */}
        <Controller
          control={control}
          name="storageState"
          render={({ field }) => (
            <StorageStateControl
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <DatePickerField
          label={t('labels.expirationDate')}
          value={form.expirationDate ?? null}
          onChange={form.changeExpiry}
          placeholder={t('instructions.expiryOptional')}
          minimumDate={new Date()}
          clearable
        />

        {/* Total paid (Optional) */}
        {askPrice ? (
          <View style={styles.section}>
            <FormInput
              label={t('labels.totalPaid')}
              value={form.actualPriceInput}
              onChangeText={form.changePrice}
              placeholder={localizeNumericHint('0.00')}
              keyboardType="decimal-pad"
              error={errors.actualPriceInput?.message}
            />
            {form.perUnitPrice != null ? (
              <PerUnitHint
                price={money(form.perUnitPrice)}
                unit={lineUnitLabel}
                style={styles.perUnitHint}
              />
            ) : null}
          </View>
        ) : null}

        {/* Notes (Optional) */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <FormInput
                label={t('labels.notesOptional')}
                value={field.value}
                onChangeText={field.onChange}
                placeholder={t('moveToPantry.notesPlaceholder')}
                multiline
                numberOfLines={2}
              />
            )}
          />
        </View>

        {/* Remove from List Toggle */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <Text role="bodyStrong">
              {t('moveToPantry.removeFromShopping')}
            </Text>
            <Text
              role="caption"
              tone="secondary"
              style={styles.toggleDescription}
            >
              {t('moveToPantry.removeFromShoppingDesc')}
            </Text>
          </View>
          <Controller
            control={control}
            name="removeFromList"
            render={({ field }) => (
              <BaseSwitch
                accessibilityLabel={t('moveToPantry.removeFromShopping')}
                value={field.value}
                onValueChange={field.onChange}
              />
            )}
          />
        </View>
      </DropdownStack>
    </>
  );
};

export const MoveToPantryModal: React.FC<MoveToPantryModalProps> = ({
  visible,
  shoppingListItemId,
  ...form
}) => {
  const moveItem = useMoveToPantryItem({ shoppingListItemId, skip: !visible });
  const { shoppingListItem } = moveItem;
  const open = visible && !!shoppingListItem;
  const opening = useOpening(open);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={open}
      onDismiss={form.onClose}
      snapPoints={['75%', '95%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {opening && shoppingListItem ? (
        <MoveToPantryForm
          // A new line or pantry seeds afresh, as a new opening does.
          key={`${opening.id}:${shoppingListItem.id}:${form.selectedPantryId}`}
          moveItem={{ ...moveItem, shoppingListItem }}
          {...form}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  perUnitHint: {
    marginTop: theme.spacing.xs,
  },
  contentContainer: {
    paddingBottom: theme.spacing.md,
  },
  itemInfo: {
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
