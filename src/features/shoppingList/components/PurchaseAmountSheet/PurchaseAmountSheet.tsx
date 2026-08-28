import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import {
  BottomSheetModal,
  useStandardBottomSheet,
} from '#hooks/useStandardBottomSheet';
import { Header } from '#/components/molecules/Header';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { formatQuantity } from '#/utils/formatQuantity';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';
import { totalFromUnitPrice, unitPriceFromTotal } from '#/utils/purchasePrice';

interface PurchaseAmountSheetItem {
  id: string;
  itemName: string;
  requestedQuantity: number;
  unitName: string | null;
  /** Per unit; the sheet seeds its total from it × `requestedQuantity`. */
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
}

/**
 * Parse a plain numeric input (decimals or whole numbers) to a number.
 * Returns null for empty/invalid/negative input.
 */
const parseNumberInput = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const num = parseDecimalInput(trimmed);
  return isNaN(num) || num < 0 ? null : num;
};

/**
 * Format a price for pre-fill — empty string when unknown so the input renders
 * its placeholder rather than "0", and the device's decimal separator so the
 * keypad can retype what it shows.
 */
const formatPrice = (price: number | null): string =>
  formatNumberForInput(price);

/**
 * PurchaseAmountSheet - Bottom sheet to record the actual purchased amounts.
 *
 * Opens pre-filled with the requested quantity and the estimated TOTAL
 * (per-unit estimate × quantity) when the user marks an unpurchased item as
 * purchased. The price asked for is the total paid, because that is what a
 * shopper reads off the receipt; a per-unit hint shows how it will be split.
 * Confirm records the amounts; Cancel dismisses without purchasing.
 */
export const PurchaseAmountSheet: React.FC<PurchaseAmountSheetProps> = ({
  visible,
  item,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { ref, modalProps } = useStandardBottomSheet({
    visible: visible && !!item,
    onDismiss: onClose,
    snapPoints: ['45%'],
  });

  const [quantityInput, setQuantityInput] = useState('');
  const [priceInput, setPriceInput] = useState('');

  // Seed the inputs only when the sheet opens or the item changes (render-time
  // state update), not on every item-field change — prevents a flash-back while
  // the confirm mutation is in flight.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevItemId, setPrevItemId] = useState(item?.id);
  if (visible !== prevVisible || item?.id !== prevItemId) {
    setPrevVisible(visible);
    setPrevItemId(item?.id);
    if (visible && item) {
      setQuantityInput(formatQuantity(item.requestedQuantity));
      setPriceInput(
        formatPrice(
          totalFromUnitPrice(item.estimatedPrice, item.requestedQuantity),
        ),
      );
    }
  }

  const parsedQty = parseNumberInput(quantityInput);
  const parsedTotal = parseNumberInput(priceInput);
  // Shown only when the split is not trivial — at quantity 1 the per-unit
  // price IS the total.
  const perUnitPrice =
    parsedQty != null && parsedQty > 0 && parsedQty !== 1 && parsedTotal != null
      ? unitPriceFromTotal(parsedTotal, parsedQty)
      : null;

  // A quantity the user cannot see is not a quantity of zero. `?? 0` sent an
  // empty or unparseable field through as a real measurement, and
  // `unitPriceFromTotal`'s zero-guard then returned the total UN-divided — so
  // the server recorded `purchasedPrice x 0`, marking the item purchased at
  // quantity 0 for nothing and discarding the amount the shopper typed.
  const quantityIsUsable = parsedQty != null && parsedQty > 0;
  // Reported on the field, never through an alert: a modal covers the form and,
  // once dismissed, no longer says which field it meant.
  const quantityError = quantityIsUsable
    ? null
    : t('purchaseAmountSheet.quantityRequired');

  const handleConfirm = () => {
    if (!quantityIsUsable || parsedQty == null) return;
    onConfirm(parsedQty, parsedTotal);
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <Header
        title={t('purchaseAmountSheet.title')}
        centerTitle
        onClose={onClose}
        rightActions={[
          {
            icon: 'checkmark',
            onPress: handleConfirm,
            variant: 'primary',
            disabled: loading || !quantityIsUsable,
            loading,
          },
        ]}
      />
      <View style={styles.headerSpacer} />
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Item being marked purchased */}
        <Text size="lg" weight="semibold" style={styles.itemName}>
          {item?.itemName ?? ''}
        </Text>

        {/* Quantity Section */}
        <View style={styles.section}>
          <Text
            size="sm"
            weight="medium"
            tone="secondary"
            style={styles.sectionLabel}
          >
            {t('labels.quantity')}
          </Text>
          <View style={styles.inputRow}>
            <ThemedBottomSheetTextInput
              style={styles.input}
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={10}
              accessibilityLabel={t('labels.quantity')}
              testID="purchase-quantity-input"
            />
            {item?.unitName ? (
              <Text size="base" tone="secondary" style={styles.affix}>
                {item.unitName}
              </Text>
            ) : null}
          </View>
          {quantityError ? (
            <Text
              size="sm"
              tone="error"
              style={styles.fieldError}
              testID="purchase-quantity-error"
            >
              {quantityError}
            </Text>
          ) : null}
        </View>

        {/* Price Section */}
        <View style={styles.section}>
          <Text
            size="sm"
            weight="medium"
            tone="secondary"
            style={styles.sectionLabel}
          >
            {t('purchaseAmountSheet.totalPrice')}
          </Text>
          <View style={styles.inputRow}>
            <Text size="base" tone="secondary" style={styles.prefix}>
              {t('purchaseAmountSheet.currencySymbol')}
            </Text>
            <ThemedBottomSheetTextInput
              style={styles.input}
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={10}
              placeholder={localizeNumericHint(
                t('purchaseAmountSheet.pricePlaceholder'),
              )}
              accessibilityLabel={t('purchaseAmountSheet.totalPrice')}
              testID="purchase-price-input"
            />
          </View>
          {perUnitPrice != null ? (
            <Text size="xs" tone="secondary" style={styles.perUnitHint}>
              {t('purchaseAmountSheet.perUnitHint', {
                price: formatCurrency(perUnitPrice, DEFAULT_CURRENCY),
              })}
            </Text>
          ) : null}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  headerSpacer: {
    height: theme.spacing.md,
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
    borderWidth: 1,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.semibold,
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
