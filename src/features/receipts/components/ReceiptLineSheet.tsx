import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import { useReceiptMoney } from '../hooks/useReceiptCurrency';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { Text } from '#components/atoms/Text';
import { FormInput } from '#components/atoms/FormInput';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { FractionInput } from '#components/molecules/FractionInput';
import { Button } from '#components/molecules/Button';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { ItemAutocompleteField } from '#features/catalog/ui/autocomplete/ItemAutocompleteField';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { useResolveUnit } from '#features/catalog/hooks/useResolveUnit';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import { statesContents, takesContents } from '#domain/stockAmount';
import { localizeNumericHint } from '#utils/formatters/number';
import { reportValidationErrors } from '#utils/validation/common';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';
import type { ReceiptReviewLine } from '../utils/receiptReviewLines';
import type { ListMatchKey } from '../utils/linkReceiptLines';
import type { ReceiptCandidate } from '../hooks/useReceiptMatches';
import {
  receiptLineDefaults,
  receiptLineSchema,
  toLineChoice,
  type ReceiptLineAmountSeed,
  type ReceiptLineFormContext,
  type ReceiptLineFormValues,
} from './receiptLineFormConfig';
import { receiptsTestIDs } from '../testIDs';
import { useEarlierPurchases } from './useEarlierPurchases';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

// The picker's choice for a line that is a purchase of its own.
const NEW_PURCHASE = 'new';

/** The form field showing a refusal on the fact the API named; null shows it by the purchase. */
const refusedField = (
  on: string | undefined,
): 'quantityInput' | 'priceInput' | 'itemName' | null => {
  switch (on) {
    case 'amount':
      return 'quantityInput';
    case 'totalPaid':
    case 'discount':
      return 'priceInput';
    case 'item':
      return 'itemName';
    case undefined:
    default:
      return null;
  }
};

interface ReceiptLineFormProps {
  line: ReceiptReviewLine;
  choice: ReceiptLineChoice | undefined;
  /** What its list line asked for, which a line whose amount is asked opens with. */
  asked?: ReceiptLineAmountSeed;
  /** False for a line already left out, where leaving it out does nothing. */
  canLeaveOut: boolean;
  /** Items the API proposes for the line, best first. */
  candidates: readonly ReceiptCandidate[];
  /** Why the API refused the line last, and the fact it named. */
  refusal?: { message: string; on?: string };
  /** The shopping list line the product and unit being picked would tick off. */
  listItemNameFor: (key: ListMatchKey) => string | undefined;
  /** A product picked before it is saved, so its list line is asked for. */
  onPickItem: (itemId: string) => void;
  onClose: () => void;
  onSave: (choice: ReceiptLineChoice) => void;
  onRemove: () => void;
}

// Mounted per opening, so the defaults are the form's seed and no reset runs.
const ReceiptLineForm: React.FC<ReceiptLineFormProps> = ({
  line,
  choice,
  asked,
  canLeaveOut,
  candidates,
  refusal,
  listItemNameFor,
  onPickItem,
  onClose,
  onSave,
  onRemove,
}) => {
  const { t } = useTranslation();
  const money = useReceiptMoney();
  const { resolveUnitId, heldUnitFor } = useResolveUnit();
  const unitTypeOf = (unitText: string) => heldUnitFor(unitText)?.type ?? null;
  const {
    control,
    handleSubmit,
    getValues,
    getFieldState,
    setValue,
    setError,
    trigger,
    formState: { isDirty },
  } = useForm<ReceiptLineFormValues, ReceiptLineFormContext>({
    resolver: yupResolver(receiptLineSchema),
    context: { free: line.price === 0 && (line.discount ?? 0) > 0 },
    defaultValues: receiptLineDefaults(line, choice, unitTypeOf, asked),
  });
  useSheetUnsavedInput(isDirty);

  // Shown on the field it names as the sheet opens, until that field changes.
  const refusedOn = refusedField(refusal?.on);
  const refusedMessage = refusal?.message;
  useEffect(() => {
    if (refusedOn && refusedMessage) {
      setError(refusedOn, { type: 'server', message: refusedMessage });
    }
  }, [refusedOn, refusedMessage, setError]);

  // `useWatch`, not `watch`: the compiler cannot memoize the latter's function.
  const itemId = useWatch({ control, name: 'itemId' });
  const unitId = useWatch({ control, name: 'unitId' });
  const unitText = useWatch({ control, name: 'unitValue' });
  const unitType = useWatch({ control, name: 'unitType' });
  // A bare count, or one in a counted unit, can say what each package holds.
  const countsPackages = takesContents(unitType);
  // The whole-packages and size-unit rules read the size and the unit's kind.
  const recheckPackages = () => {
    if (getFieldState('quantityInput').invalid) void trigger('quantityInput');
    if (getFieldState('sizeUnitDisplay').invalid) {
      void trigger('sizeUnitDisplay');
    }
  };
  const existingPurchaseId = useWatch({ control, name: 'existingPurchaseId' });
  // A purchase picked is one of the product the line named: another product
  // leaves the line a new purchase until one of its own is picked.
  const dropEarlierPick = () => {
    setValue('existingPurchaseId', null);
    setValue('existingPurchaseVersion', null);
  };
  const listItemName = listItemNameFor({ itemId, unitId, unitText });
  // Offered, never picked for the user: a similar purchase may be another one.
  const earlier = useEarlierPurchases(itemId);
  const pickedElsewhere =
    existingPurchaseId !== null &&
    !earlier.some(purchase => purchase.id === existingPurchaseId);
  const earlierOptions = [
    {
      key: NEW_PURCHASE,
      label: t('receipts.review.newPurchase'),
      testID: receiptsTestIDs.lineNewPurchase,
    },
    ...earlier.map(purchase => ({
      key: purchase.id,
      label: t('receipts.review.earlierPurchase', {
        amount: purchase.amount,
        date: purchase.boughtOn,
      }),
      testID: receiptsTestIDs.lineEarlierPurchase(purchase.id),
    })),
    ...(pickedElsewhere
      ? [
          {
            key: existingPurchaseId,
            label: t('receipts.review.earlierPicked'),
            testID: receiptsTestIDs.lineEarlierPurchase(existingPurchaseId),
          },
        ]
      : []),
  ];
  const attached = existingPurchaseId !== null;
  const chipLabel = ({ itemName, detail }: ReceiptCandidate): string =>
    detail === null
      ? itemName
      : t('labels.nameWithDetail', { name: itemName, detail });

  // A typed unit is resolved on the device first: the check-in takes a unit's
  // id, never its name.
  const save = handleSubmit(async values => {
    const typedUnit = values.unitValue.trim();
    const resolvedUnitId = await resolveUnitId(values.unitId, typedUnit);
    if (typedUnit && !resolvedUnitId) {
      setError('unitValue', {
        message: t('itemForm.unknownUnit', { unit: typedUnit }),
      });
      return;
    }
    const sized = statesContents(values);
    const typedSizeUnit = values.sizeUnitDisplay.trim();
    const sizeUnitId = sized
      ? await resolveUnitId(values.sizeUnitId, typedSizeUnit)
      : null;
    if (sized && !sizeUnitId) {
      setError('sizeUnitDisplay', {
        message: t('itemForm.unknownUnit', { unit: typedSizeUnit }),
      });
      return;
    }
    // A purchase that changed since it was picked is sent as it reads now,
    // which is what the picker shows.
    const current = earlier.find(
      purchase => purchase.id === values.existingPurchaseId,
    );
    onSave(
      toLineChoice({
        ...values,
        unitId: resolvedUnitId,
        sizeUnitId,
        existingPurchaseVersion:
          current?.version ?? values.existingPurchaseVersion,
      }),
    );
    onClose();
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('receipts.review.editTitle')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void save();
            },
            testID: receiptsTestIDs.lineSave,
          }}
        />
      </SheetHeaderSlot>

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
                  dropEarlierPick();
                }}
                // No unit from the suggestion: its default is the unit a recipe
                // uses, and a blank one stocks the item in its tracking unit.
                onSelectItem={item => {
                  setValue('itemId', item.id);
                  onPickItem(item.id);
                }}
                placeholder={t('receipts.review.productPlaceholder')}
                required
                error={fieldState.error?.message}
                testID={receiptsTestIDs.lineProduct}
              />
            )}
          />
          {candidates.length > 0 && (
            <View style={styles.suggestions}>
              <Text role="caption" tone="secondary">
                {t('labels.suggested')}
              </Text>
              <ChipScrollRow
                options={candidates.map((candidate, at) => ({
                  key: candidate.itemId,
                  label: chipLabel(candidate),
                  testID: receiptsTestIDs.lineSuggestion(at),
                }))}
                selected={itemId}
                onSelect={key => {
                  const picked = candidates.find(
                    candidate => candidate.itemId === key,
                  );
                  if (!picked) return;
                  if (picked.itemId !== itemId) dropEarlierPick();
                  setValue('itemName', picked.itemName, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  setValue('itemId', picked.itemId);
                  onPickItem(picked.itemId);
                }}
                edgeFadeColor="surface"
              />
            </View>
          )}
        </View>

        {earlierOptions.length > 1 && (
          <View style={styles.suggestions}>
            <Text role="caption" tone="secondary">
              {t('receipts.review.earlierTitle')}
            </Text>
            <ChipScrollRow
              options={earlierOptions}
              selected={existingPurchaseId ?? NEW_PURCHASE}
              onSelect={key => {
                const picked = earlier.find(purchase => purchase.id === key);
                if (key !== NEW_PURCHASE && !picked) return;
                setValue('existingPurchaseId', picked?.id ?? null, {
                  shouldDirty: true,
                });
                setValue('existingPurchaseVersion', picked?.version ?? null);
              }}
              edgeFadeColor="surface"
            />
            {attached ? (
              <Text role="caption" tone="tertiary">
                {t('receipts.review.earlierBody')}
              </Text>
            ) : null}
            {attached && refusal && !refusedOn ? (
              <Text
                role="error"
                tone="error"
                testID={receiptsTestIDs.lineRefusal}
              >
                {refusal.message}
              </Text>
            ) : null}
          </View>
        )}

        {!!listItemName && !attached && (
          <Controller
            control={control}
            name="offList"
            render={({ field }) => (
              <SettingSwitch
                title={t('receipts.review.tickOffTitle')}
                description={t('receipts.review.tickOffBody', {
                  name: listItemName,
                })}
                value={!field.value}
                onValueChange={on => field.onChange(!on)}
                testID={receiptsTestIDs.lineTickOff}
                containerStyle={styles.listToggle}
              />
            )}
          />
        )}

        {!attached && (
          <Controller
            control={control}
            name="notStocked"
            render={({ field }) => (
              <SettingSwitch
                title={t('receipts.review.notStockedTitle')}
                description={t('receipts.review.notStockedBody')}
                value={field.value}
                onValueChange={on => {
                  field.onChange(on);
                  // A purchase still names what was bought: what the receipt prints.
                  if (on && !getValues('itemName').trim()) {
                    setValue('itemName', line.printed, {
                      shouldValidate: true,
                    });
                  }
                }}
                testID={receiptsTestIDs.lineNotStocked}
                containerStyle={styles.listToggle}
              />
            )}
          />
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
              render={({ field, fieldState }) => (
                <UnitAutocompleteField
                  variant="inline"
                  label={t('labels.unit')}
                  value={field.value}
                  onChangeText={text => {
                    field.onChange(text);
                    setValue('unitId', null);
                    setValue('unitType', unitTypeOf(text));
                    recheckPackages();
                  }}
                  onUnitSelected={(id, _name, pickedType) => {
                    setValue('unitId', id);
                    setValue(
                      'unitType',
                      pickedType ?? unitTypeOf(getValues('unitValue')),
                    );
                    recheckPackages();
                  }}
                  placeholder={t('labels.pcsKgEtc')}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
        </View>

        {!!countsPackages && (
          <View style={styles.section}>
            <Controller
              control={control}
              name="sizeInput"
              render={({ field: size, fieldState: sizeState }) => (
                <Controller
                  control={control}
                  name="sizeUnitDisplay"
                  render={({ field: unit, fieldState: unitState }) => (
                    <PackageContentsFields
                      variant="inline"
                      size={size.value}
                      onSizeChange={text => {
                        size.onChange(text);
                        recheckPackages();
                      }}
                      sizeError={sizeState.error?.message}
                      unit={unit.value}
                      onUnitChange={text => {
                        unit.onChange(text);
                        setValue('sizeUnitId', null);
                        setValue('sizeUnitType', null);
                      }}
                      onUnitSelected={(id, _name, pickedType) => {
                        setValue('sizeUnitId', id);
                        setValue('sizeUnitType', pickedType ?? null);
                      }}
                      unitError={unitState.error?.message}
                      sizeTestID={receiptsTestIDs.lineSize}
                      unitTestID={receiptsTestIDs.lineSizeUnit}
                    />
                  )}
                />
              )}
            />
          </View>
        )}

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

      {!!canLeaveOut && (
        <Button variant="ghost" icon="close-circle-outline" onPress={onRemove}>
          {t('receipts.review.dontAdd')}
        </Button>
      )}
    </>
  );
};

interface ReceiptLineSheetProps extends Omit<ReceiptLineFormProps, 'line'> {
  visible: boolean;
  /** The line being edited, kept after closing so the sheet animates out full. */
  line: ReceiptReviewLine | null;
  /** Changes on every opening, so each one starts from the saved choice. */
  opening: number;
}

/** Picks the product a receipt line is, with its amount and price. */
export const ReceiptLineSheet: React.FC<ReceiptLineSheetProps> = ({
  visible,
  line,
  opening,
  ...form
}) => (
  <Sheet
    mode="form"
    headerFromContent
    visible={visible ? !!line : false}
    onDismiss={form.onClose}
    snapPoints={['85%']}
    contentContainerStyle={styles.content}
  >
    {!!line && <ReceiptLineForm key={opening} line={line} {...form} />}
  </Sheet>
);

const styles = StyleSheet.create(theme => ({
  content: {
    paddingBottom: theme.spacing.md,
  },
  printed: {
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
  suggestions: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
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
    paddingHorizontal: 0,
    marginBottom: theme.spacing.lg,
    borderBottomWidth: theme.borderWidth.none,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  unitField: {
    flex: 0.6,
  },
}));
