import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { useMoney } from '#domain/money';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { Text } from '#components/atoms/Text';
import { FormInput } from '#components/atoms/FormInput';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { FractionInput } from '#components/molecules/FractionInput';
import { Button } from '#components/molecules/Button';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { ItemAutocompleteField } from '#features/catalog/ui/autocomplete/ItemAutocompleteField';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { localizeNumericHint } from '#/utils/formatters/number';
import { logValidationErrors } from '#/utils/validation/common';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';
import type { ReceiptReviewLine } from '../utils/receiptReviewLines';
import type { ListMatchKey } from '../utils/linkReceiptLines';
import {
  receiptLineDefaults,
  receiptLineSchema,
  toLineChoice,
  type ReceiptLineFormValues,
} from './receiptLineFormConfig';
import { receiptsTestIDs } from '../testIDs';

interface ReceiptLineFormProps {
  line: ReceiptReviewLine;
  choice: ReceiptLineChoice | undefined;
  /** The shopping list line the product and unit being picked would tick off. */
  listItemNameFor: (key: ListMatchKey) => string | undefined;
  onClose: () => void;
  onSave: (choice: ReceiptLineChoice) => void;
  onRemove: () => void;
}

// Mounted per opening, so the defaults are the form's seed and no reset runs.
const ReceiptLineForm: React.FC<ReceiptLineFormProps> = ({
  line,
  choice,
  listItemNameFor,
  onClose,
  onSave,
  onRemove,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const { control, handleSubmit, setValue } = useForm<ReceiptLineFormValues>({
    resolver: yupResolver(receiptLineSchema),
    defaultValues: receiptLineDefaults(line, choice),
  });

  // `useWatch`, not `watch`: the compiler cannot memoize the latter's function.
  const itemId = useWatch({ control, name: 'itemId' });
  const unitId = useWatch({ control, name: 'unitId' });
  const unitText = useWatch({ control, name: 'unitValue' });
  const listItemName = listItemNameFor({ itemId, unitId, unitText });

  const save = handleSubmit(values => {
    onSave(toLineChoice(values));
    onClose();
  }, logValidationErrors);

  return (
    <>
      <SheetHeader
        contentPadding="md"
        title={t('receipts.review.editTitle')}
        onClose={onClose}
        confirm={{
          onPress: () => {
            void save();
          },
          testID: receiptsTestIDs.lineSave,
        }}
      />

      <View style={styles.printed}>
        <Text role="caption" tone="secondary">
          {t('receipts.review.printedLabel')}
        </Text>
        <View style={styles.printedRow}>
          <Text role="bodyStrong" style={styles.printedText}>
            {line.printed}
          </Text>
          {line.price !== undefined && (
            <Text role="bodyStrong">{money(line.price)}</Text>
          )}
        </View>
      </View>

      <DropdownStack>
        <View style={styles.section}>
          <Controller
            control={control}
            name="itemName"
            render={({ field, fieldState }) => (
              <ItemAutocompleteField
                variant="inline"
                label={t('labels.itemName')}
                value={field.value}
                onChangeText={text => {
                  field.onChange(text);
                  setValue('itemId', null);
                }}
                // No unit from the suggestion: its default is the unit a recipe
                // uses, and a blank one stocks the item in its tracking unit.
                onSelectItem={item => setValue('itemId', item.id)}
                placeholder={t('receipts.review.productPlaceholder')}
                required
                error={fieldState.error?.message}
                testID={receiptsTestIDs.lineProduct}
              />
            )}
          />
        </View>

        {!!listItemName && (
          <View style={styles.listToggle}>
            <View style={styles.listToggleText}>
              <Text role="bodyStrong">{t('receipts.review.tickOffTitle')}</Text>
              <Text role="caption" tone="secondary">
                {t('receipts.review.tickOffBody', { name: listItemName })}
              </Text>
            </View>
            <Controller
              control={control}
              name="offList"
              render={({ field }) => (
                <BaseSwitch
                  accessibilityLabel={t('receipts.review.tickOffTitle')}
                  value={!field.value}
                  onValueChange={on => field.onChange(!on)}
                  testID={receiptsTestIDs.lineTickOff}
                />
              )}
            />
          </View>
        )}

        <View style={styles.amountRow}>
          <View style={styles.quantityField}>
            <Controller
              control={control}
              name="quantityInput"
              render={({ field, fieldState }) => (
                <FractionInput
                  label={t('labels.quantity')}
                  value={field.value}
                  onChangeText={field.onChange}
                  required
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
          <View style={styles.unitField}>
            <Controller
              control={control}
              name="unitValue"
              render={({ field }) => (
                <UnitAutocompleteField
                  variant="inline"
                  label={t('storageLocationForm.unit')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onUnitSelected={id => setValue('unitId', id)}
                  placeholder={t('labels.pcsKgEtc')}
                />
              )}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Controller
            control={control}
            name="priceInput"
            render={({ field, fieldState }) => (
              <FormInput
                label={t('labels.totalPaid')}
                value={field.value}
                onChangeText={field.onChange}
                placeholder={localizeNumericHint('0.00')}
                keyboardType="decimal-pad"
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
      </DropdownStack>

      {!!choice && (
        <Button variant="ghost" icon="close-circle-outline" onPress={onRemove}>
          {t('receipts.review.dontAdd')}
        </Button>
      )}
    </>
  );
};

interface ReceiptLineSheetProps {
  visible: boolean;
  /** The line being edited, kept after closing so the sheet animates out full. */
  line: ReceiptReviewLine | null;
  choice: ReceiptLineChoice | undefined;
  listItemNameFor: (key: ListMatchKey) => string | undefined;
  /** Changes on every opening, so each one starts from the saved choice. */
  opening: number;
  onClose: () => void;
  onSave: (choice: ReceiptLineChoice) => void;
  onRemove: () => void;
}

/** Picks the product a receipt line is, with its amount and price. */
export const ReceiptLineSheet: React.FC<ReceiptLineSheetProps> = ({
  visible,
  line,
  choice,
  listItemNameFor,
  opening,
  onClose,
  onSave,
  onRemove,
}) => (
  <Sheet
    mode="form"
    visible={visible ? !!line : false}
    onDismiss={onClose}
    snapPoints={['85%']}
    contentContainerStyle={styles.content}
  >
    {!!line && (
      <ReceiptLineForm
        key={opening}
        line={line}
        choice={choice}
        listItemNameFor={listItemNameFor}
        onClose={onClose}
        onSave={onSave}
        onRemove={onRemove}
      />
    )}
  </Sheet>
);

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  printed: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  printedRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  printedText: {
    flex: 1,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  amountRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  quantityField: {
    flex: 0.4,
  },
  listToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  listToggleText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  unitField: {
    flex: 0.6,
  },
}));
