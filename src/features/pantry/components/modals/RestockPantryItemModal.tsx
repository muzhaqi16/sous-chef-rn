import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { Link } from '#components/atoms/Link';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { ConversionPreview } from '#features/pantry/components/ConversionPreview';
import { FractionQuickSelect } from '#features/pantry/components/FractionQuickSelect';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import {
  isPickedWhenSized,
  isWholeWhenSized,
} from '#features/pantry/ui/packageContentsRules';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatQuantityForInput,
  formatQuantityWithUnit,
} from '#/utils/formatQuantity';
import { useConversionPreview } from '#features/pantry/hooks/useConversionPreview';
import { actionConversionOptions } from '#features/pantry/hooks/useQuantityFeedback';
import { inCountedUnit } from '#domain/stockDisplay';
import {
  restockContentsOf,
  statedContents,
  type PackageContentsValues,
  type RestockContents,
} from '#domain/stockAmount';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import { PantryActionModal } from '#features/pantry/components/modals/PantryActionModal';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';
import { parseMoneyInput } from '#/utils/validation/common';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import type {
  PantryActionSharedState,
  ShownQuantity,
} from '#features/pantry/types';

interface RestockPantryItemModalProps {
  visible: boolean;
  pantryItemId: string | null;
  /** Why the amount is asked, shown on its field until it is edited. */
  reason?: string;
  onClose: () => void;
  onConfirm: (
    quantity: number,
    quantityInput: string,
    notes: string,
    unitId?: string,
    costPerUnit?: number,
    totalCost?: number,
    expiresAt?: Date | null,
    contents?: RestockContents | null,
  ) => Promise<string | null>;
}

type StatedSize = Omit<PackageContentsValues, 'unitType'>;

const NO_SIZE: StatedSize = {
  sizeInput: '',
  sizeUnitDisplay: '',
  sizeUnitId: null,
  sizeUnitType: null,
};

/** The server sizes only packages counted in the stack's own unit. */
const countedInOwnUnit = ({ selectedUnitInfo }: PantryActionSharedState) =>
  selectedUnitInfo?.isTrackingUnit === true &&
  selectedUnitInfo.unitType === UnitType.Count;

export const RestockPantryItemModal: React.FC<RestockPantryItemModalProps> = ({
  visible,
  pantryItemId,
  reason,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const asksCost = useBudgetAndPricesEnabled();
  const [quantityInput, setQuantityInput] = useState('1');
  // Outside `handleReset`, which runs as the modal opens.
  const [quantityEdited, setQuantityEdited] = useState(false);
  const [costPerUnitInput, setCostPerUnitInput] = useState('');
  const [totalCostInput, setTotalCostInput] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [confirmRefused, setConfirmRefused] = useState(false);
  const [askingSize, setAskingSize] = useState(false);
  const [statedSize, setStatedSize] = useState(NO_SIZE);
  const [sizeRefusal, setSizeRefusal] = useState<string | null>(null);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);

  const handleReset = () => {
    setQuantityInput('1');
    setCostPerUnitInput('');
    setTotalCostInput('');
    setExpiresAt(null);
    setConfirmRefused(false);
    setAskingSize(false);
    setStatedSize(NO_SIZE);
    setSizeRefusal(null);
  };

  const editSize = (edit: Partial<StatedSize>) => {
    setSizeRefusal(null);
    setStatedSize(stated => ({ ...stated, ...edit }));
  };

  const quantityValue = parseFractionalInput(quantityInput);
  const quantityIsUsable =
    quantityValue !== null && !isNaN(quantityValue) && quantityValue > 0;
  // Off, the cost fields are hidden: they neither block a restock nor send one.
  const costPerUnit = asksCost ? parseMoneyInput(costPerUnitInput) : null;
  const totalCost = asksCost ? parseMoneyInput(totalCostInput) : null;
  const { sizeInput, sizeUnitId } = statedSize;
  const size = parseDecimalInput(sizeInput);
  const sizeIsUsable = !sizeInput.trim() || (!Number.isNaN(size) && size > 0);
  const countIsWhole = isWholeWhenSized(
    quantityInput,
    UnitType.Count,
    sizeInput,
  );
  const sizeUnitIsPicked = isPickedWhenSized(
    sizeUnitId,
    UnitType.Count,
    sizeInput,
  );
  // On the fields once a confirm is refused, then live; until then the
  // quantity field's own format hint speaks.
  const errorOn = (refused: boolean, key: TranslationKey) =>
    confirmRefused && refused ? t(key) : undefined;
  const errors = {
    quantity:
      errorOn(!quantityIsUsable, 'errors.invalidQuantity') ??
      errorOn(!countIsWhole, 'packageSize.wholePackages') ??
      (quantityEdited ? undefined : reason),
    costPerUnit: errorOn(costPerUnit === undefined, 'errors.invalidAmountPaid'),
    totalCost: errorOn(totalCost === undefined, 'errors.invalidAmountPaid'),
    size:
      errorOn(!sizeIsUsable, 'packageSize.sizeInvalid') ??
      sizeRefusal ??
      undefined,
    sizeUnit: errorOn(!sizeUnitIsPicked, 'packageSize.unitRequired'),
  };

  const handleConfirm = async (shared: PantryActionSharedState) => {
    if (!pantryItemId || awaitingAnswer) return;
    const sized = countedInOwnUnit(shared);
    if (
      !quantityIsUsable ||
      costPerUnit === undefined ||
      totalCost === undefined ||
      (sized && !(sizeIsUsable && countIsWhole && sizeUnitIsPicked))
    ) {
      setConfirmRefused(true);
      return;
    }

    const contents = sized
      ? statedContents({ ...statedSize, unitType: UnitType.Count })
      : null;
    // Pass the quantity and unit directly — the backend handles conversion
    const answer = onConfirm(
      quantityValue,
      quantityInput,
      shared.notes,
      shared.activeUnitId,
      costPerUnit ?? undefined,
      totalCost ?? undefined,
      expiresAt,
      contents && restockContentsOf(contents, shared.portionUnitId),
    );
    if (!contents) {
      onClose();
      return;
    }
    // The sheet closes on success; a refusal stays to say why on the field.
    setAwaitingAnswer(true);
    setSizeRefusal(await answer);
    setAwaitingAnswer(false);
  };

  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      title={t('restockItem.title')}
      confirmLabel={t('labels.restock')}
      snapPoints={['80%', '95%']}
      unitToggleLabel={t('restockItem.restockBy')}
      currentQuantityLabel={t('restockItem.currentLabel')}
      operation={PantryOperation.Restock}
      onConfirm={shared => {
        void handleConfirm(shared);
      }}
      onReset={handleReset}
      renderActionFields={shared => (
        <RestockActionFields
          quantityInput={quantityInput}
          setQuantityInput={value => {
            setQuantityEdited(true);
            setQuantityInput(value);
          }}
          costPerUnitInput={costPerUnitInput}
          setCostPerUnitInput={setCostPerUnitInput}
          totalCostInput={totalCostInput}
          setTotalCostInput={setTotalCostInput}
          asksCost={asksCost}
          expiresAt={expiresAt}
          setExpiresAt={setExpiresAt}
          errors={errors}
          shared={shared}
          askingSize={askingSize}
          onAskSize={() => setAskingSize(true)}
          statedSize={statedSize}
          onSizeEdit={editSize}
        />
      )}
    />
  );
};

const RestockActionFields: React.FC<{
  quantityInput: string;
  setQuantityInput: (v: string) => void;
  costPerUnitInput: string;
  setCostPerUnitInput: (v: string) => void;
  totalCostInput: string;
  setTotalCostInput: (v: string) => void;
  asksCost: boolean;
  expiresAt: Date | null;
  setExpiresAt: (v: Date | null) => void;
  errors: Record<
    'quantity' | 'costPerUnit' | 'totalCost' | 'size' | 'sizeUnit',
    string | undefined
  >;
  shared: PantryActionSharedState;
  askingSize: boolean;
  onAskSize: () => void;
  statedSize: StatedSize;
  onSizeEdit: (edit: Partial<StatedSize>) => void;
}> = ({
  quantityInput,
  setQuantityInput,
  costPerUnitInput,
  setCostPerUnitInput,
  totalCostInput,
  setTotalCostInput,
  asksCost,
  expiresAt,
  setExpiresAt,
  errors,
  shared,
  askingSize,
  onAskSize,
  statedSize,
  onSizeEdit,
}) => {
  const { t } = useTranslation();
  const addAmount = parseFractionalInput(quantityInput);

  // For dual-tracked items, show conversion to net weight unit (e.g. cups → grams)
  const conversion = useConversionPreview(
    actionConversionOptions(addAmount, shared),
  );

  // For dual-tracked items, show new total in net weight
  const currentInUnit =
    shared.isDualTracked && shared.isConvertedUnit
      ? shared.remainingNetWeight
      : shared.isConvertedUnit
      ? shared.availableInSelectedUnit
      : shared.trackingQuantity;

  const newQuantityUnit =
    shared.isDualTracked &&
    shared.isConvertedUnit &&
    shared.netWeightUnit !== undefined
      ? shared.netWeightUnit
      : shared.activeUnit;

  let newQuantity: ShownQuantity | null = null;
  if (addAmount !== null && !isNaN(addAmount)) {
    if (shared.exactFactor !== null) {
      // The tracking unit or a dozen of it: the total reads as the stack will.
      newQuantity = shared.showStock(
        shared.trackingQuantity + inCountedUnit(addAmount, shared.exactFactor),
      );
    } else if (
      currentInUnit != null &&
      (shared.isDualTracked ? conversion.convertedValue != null : true)
    ) {
      newQuantity = {
        quantity:
          currentInUnit +
          (shared.isDualTracked && conversion.convertedValue != null
            ? conversion.convertedValue
            : addAmount),
        unit: newQuantityUnit,
        displayAsFraction: null,
      };
    }
  }

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('restockItem.quantityToAdd')}
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
          useBottomSheetInput
          required
          error={errors.quantity}
        />
        {newQuantity !== null || shared.isConvertedUnit ? (
          <View style={commonStyles.bottomSheetInfoRow}>
            {newQuantity !== null ? (
              <Text role="label" tone="accent" style={styles.newQuantityText}>
                {t('restockItem.newQuantityPrefix')}
                {formatQuantityWithUnit(newQuantity.quantity, newQuantity.unit)}
              </Text>
            ) : null}
            {shared.isConvertedUnit ? (
              <ConversionPreview
                previewText={conversion.previewText}
                loading={conversion.previewLoading}
                confidence={conversion.confidence}
              />
            ) : null}
          </View>
        ) : null}
        {shared.commonFractions != null && shared.commonFractions.length > 0 ? (
          <FractionQuickSelect
            fractions={shared.commonFractions}
            onSelect={value => setQuantityInput(formatQuantityForInput(value))}
            selectedValue={addAmount ?? undefined}
            unit={shared.activeUnit}
            displayAsFraction
          />
        ) : null}
      </View>

      {countedInOwnUnit(shared) ? (
        <View style={commonStyles.bottomSheetSection}>
          {askingSize ? (
            <PackageContentsFields
              variant="modal"
              useBottomSheetInput
              size={statedSize.sizeInput}
              onSizeChange={sizeInput => onSizeEdit({ sizeInput })}
              sizeError={errors.size}
              unit={statedSize.sizeUnitDisplay}
              onUnitChange={sizeUnitDisplay => onSizeEdit({ sizeUnitDisplay })}
              onUnitSelected={(sizeUnitId, _name, sizeUnitType = null) =>
                onSizeEdit({ sizeUnitId, sizeUnitType })
              }
              unitError={errors.sizeUnit}
            />
          ) : (
            <Link
              testID={pantryTestIDs.restockDifferentSize}
              onPress={onAskSize}
            >
              {t('restockItem.differentSize')}
            </Link>
          )}
        </View>
      ) : null}

      {/* Cost Tracking */}
      {asksCost ? (
        <View style={commonStyles.bottomSheetSection}>
          <View style={styles.costRow}>
            <View style={styles.costField}>
              <FormInput
                label={t('restockItem.costPerUnit')}
                value={costPerUnitInput}
                onChangeText={setCostPerUnitInput}
                placeholder={localizeNumericHint('0.00')}
                keyboardType="decimal-pad"
                useBottomSheetInput
                error={errors.costPerUnit}
              />
            </View>
            <View style={styles.costField}>
              <FormInput
                label={t('labels.totalPaid')}
                value={totalCostInput}
                onChangeText={setTotalCostInput}
                placeholder={localizeNumericHint('0.00')}
                keyboardType="decimal-pad"
                useBottomSheetInput
                error={errors.totalCost}
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label={t('labels.notes')}
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder={t('restockItem.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>

      {/* Expiration Date */}
      <View style={commonStyles.bottomSheetSection}>
        <DatePickerField
          label={t('labels.expirationDate')}
          value={expiresAt}
          onChange={setExpiresAt}
          placeholder={t('restockItem.expirationPlaceholder')}
          minimumDate={new Date()}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  costRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  costField: {
    flex: 1,
  },
  // The row already spaces its children; a top margin here doubles the gap.
  newQuantityText: {
    marginTop: 0,
  },
}));
