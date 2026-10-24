import React, { useState } from 'react';
import { View } from 'react-native';
import { useMoney } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  useStandardBottomSheet,
} from '#hooks/ui/useStandardBottomSheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { formatQuantityForInput } from '#/utils/formatQuantity';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';
import {
  shownUnitPrice,
  totalFromUnitPrice,
  unitPriceFromTotal,
} from '#features/shoppingList/utils/purchasePrice';
import { PerUnitHint } from '#features/shoppingList/components/PerUnitHint';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { parseMoneyInput } from '#/utils/validation/common';

interface PurchaseAmountSheetItem {
  id: string;
  itemName: string;
  requestedQuantity: number;
  unitName: string | null;
  /** Per unit; the sheet hints its total from it × `requestedQuantity`. */
  estimatedPrice: number | null;
}

interface PurchaseAmountSheetProps {
  visible: boolean;
  item: PurchaseAmountSheetItem | null;
  onClose: () => void;
  /**
   * `totalPrice` is what the shopper paid for the whole quantity — the receipt
   * line — not a per-unit price. The caller converts for the API.
   */
  onConfirm: (quantity: number, totalPrice: number | null) => void;
  loading?: boolean;
  /** A line under the price on what a typed price per unit means, if any. */
  describePrice?: (unitPrice: number) => string | null;
}

/** null for empty, invalid or negative input. */
const parseQuantityInput = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const num = parseDecimalInput(trimmed);
  return isNaN(num) || num < 0 ? null : num;
};

/**
 * Empty string when unknown, so the input shows its placeholder rather than
 * "0", and the device's separator so the keypad can retype what it shows.
 */
const formatPrice = (price: number | null): string =>
  formatNumberForInput(price);

/**
 * Records the actual purchased amounts, pre-filled with the requested quantity.
 * It asks for the total paid because that is what the receipt shows; a hint
 * gives the per-unit split.
 */
export const PurchaseAmountSheet: React.FC<PurchaseAmountSheetProps> = ({
  visible,
  item,
  onClose,
  onConfirm,
  loading = false,
  describePrice,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  // No snap points: the sheet measures its own content, so the keyboard lift
  // seats it on the keyboard instead of stretching a fixed height up the
  // screen and pushing the price field off the bottom edge.
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!item,
    onDismiss: onClose,
    snapPoints: [],
    enableDynamicSizing: true,
  });

  const [quantityInput, setQuantityInput] = useState('');
  const [priceInput, setPriceInput] = useState('');

  // Seed on open / item change only (render-time state update), or the inputs
  // flash back while the confirm mutation is in flight.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevItemId, setPrevItemId] = useState(item?.id);
  if (visible !== prevVisible || item?.id !== prevItemId) {
    setPrevVisible(visible);
    setPrevItemId(item?.id);
    if (visible && item) {
      // The seed is read back by the parsers, so it must carry the device's
      // separator; a period reads as grouping on a comma device.
      setQuantityInput(
        formatQuantityForInput(item.requestedQuantity, { notation: 'decimal' }),
      );
      setPriceInput('');
    }
  }

  // The estimate is the field's hint, never its value: confirmed unread, it
  // would record a guess as the price paid, which the API never counts.
  const estimatedTotal = item
    ? totalFromUnitPrice(item.estimatedPrice, item.requestedQuantity)
    : null;

  const parsedQty = parseQuantityInput(quantityInput);
  const parsedTotal = parseMoneyInput(priceInput);
  const perUnitPrice = shownUnitPrice(parsedTotal, parsedQty);

  // An empty or unparseable field is NOT a quantity of zero: defaulting it
  // trips `unitPriceFromTotal`'s zero-guard, which returns the total undivided
  // and records the purchase at quantity 0.
  const quantityIsUsable = parsedQty != null && parsedQty > 0;
  // On the field, never through an alert: an alert covers the form, and once
  // dismissed it cannot say which field it meant.
  const quantityError = quantityIsUsable
    ? null
    : t('purchaseAmountSheet.quantityRequired');
  const priceError =
    parsedTotal === undefined ? t('errors.invalidAmountPaid') : null;
  const priceNote =
    describePrice && quantityIsUsable && parsedTotal != null
      ? describePrice(unitPriceFromTotal(parsedTotal, parsedQty) ?? parsedTotal)
      : null;

  const handleConfirm = () => {
    if (!quantityIsUsable || parsedTotal === undefined) return;
    onConfirm(parsedQty, parsedTotal);
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      {/* NOT a keyboard-aware scrollable: it pads its content by the keyboard's
          height, and under `enableDynamicSizing` the sheet is sized to that
          content — so focusing the price field grew the sheet by a keyboard and
          scrolled the header off the top. Gorhom's own `interactive` lift seats
          this content-sized sheet on the keyboard already. */}
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        <SheetHeader
          title={t('purchaseAmountSheet.title')}
          onClose={onClose}
          confirm={{
            onPress: handleConfirm,
            disabled: !quantityIsUsable || parsedTotal === undefined,
            loading,
          }}
        />
        <View style={styles.sections}>
          <Text role="heading" style={styles.itemName}>
            {item?.itemName ?? ''}
          </Text>

          <View style={styles.section}>
            <SectionHeader variant="overline" style={styles.sectionLabel}>
              {t('labels.quantity')}
            </SectionHeader>
            <View style={styles.inputRow}>
              <ThemedBottomSheetTextInput
                style={styles.input}
                value={quantityInput}
                onChangeText={setQuantityInput}
                keyboardType="decimal-pad"
                selectTextOnFocus
                maxLength={10}
                accessibilityLabel={t('labels.quantity')}
                testID={shoppingListTestIDs.purchaseQuantityInput}
              />
              {item?.unitName ? (
                <Text role="body" tone="secondary" style={styles.affix}>
                  {item.unitName}
                </Text>
              ) : null}
            </View>
            {quantityError ? (
              <Text
                role="error"
                tone="error"
                style={styles.fieldError}
                testID={shoppingListTestIDs.purchaseQuantityError}
              >
                {quantityError}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionHeader variant="overline" style={styles.sectionLabel}>
              {t('labels.totalPaid')}
            </SectionHeader>
            <View style={styles.inputRow}>
              <Text role="body" tone="secondary" style={styles.prefix}>
                {t('purchaseAmountSheet.currencySymbol')}
              </Text>
              <ThemedBottomSheetTextInput
                style={styles.input}
                value={priceInput}
                onChangeText={setPriceInput}
                keyboardType="decimal-pad"
                selectTextOnFocus
                maxLength={10}
                placeholder={
                  estimatedTotal == null
                    ? localizeNumericHint(
                        t('purchaseAmountSheet.pricePlaceholder'),
                      )
                    : formatPrice(estimatedTotal)
                }
                accessibilityLabel={t('labels.totalPaid')}
                testID={shoppingListTestIDs.purchasePriceInput}
              />
            </View>
            {priceError ? (
              <Text
                role="error"
                tone="error"
                style={styles.fieldError}
                testID={shoppingListTestIDs.purchasePriceError}
              >
                {priceError}
              </Text>
            ) : null}
            {perUnitPrice != null ? (
              <PerUnitHint
                price={money(perUnitPrice)}
                unit={item?.unitName}
                style={styles.perUnitHint}
              />
            ) : null}
            {priceNote ? (
              <Text
                role="caption"
                tone="secondary"
                style={styles.perUnitHint}
                testID={shoppingListTestIDs.purchasePriceNote}
              >
                {priceNote}
              </Text>
            ) : null}
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.sm,
  },
  // On the inner view, so the header still spans the sheet's full width.
  sections: {
    paddingHorizontal: theme.spacing.lg,
  },
  itemName: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  fieldError: {
    marginTop: theme.spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: theme.borderWidth.hairline,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    ...theme.type.subheading,
    paddingVertical: theme.spacing.md,
    color: theme.colors.textPrimary,
  },
  affix: {
    marginLeft: theme.spacing.sm,
  },
  perUnitHint: {
    marginTop: theme.spacing.xs,
  },
  prefix: {
    marginRight: theme.spacing.sm,
  },
}));
