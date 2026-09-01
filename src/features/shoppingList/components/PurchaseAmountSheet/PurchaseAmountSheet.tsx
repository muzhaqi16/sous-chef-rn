import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
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
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';

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

/** null for empty, invalid or negative input. */
const parseNumberInput = (input: string): number | null => {
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
 * Records the actual purchased amounts, pre-filled with the requested quantity
 * and the estimated TOTAL (per-unit estimate × quantity). It asks for the total
 * paid because that is what the receipt shows; a hint gives the per-unit split.
 */
export const PurchaseAmountSheet: React.FC<PurchaseAmountSheetProps> = ({
  visible,
  item,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const { t } = useTranslation();
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

  // An empty or unparseable field is NOT a quantity of zero: defaulting it
  // trips `unitPriceFromTotal`'s zero-guard, which returns the total undivided
  // and records the purchase at quantity 0.
  const quantityIsUsable = parsedQty != null && parsedQty > 0;
  // On the field, never through an alert: an alert covers the form, and once
  // dismissed it cannot say which field it meant.
  const quantityError = quantityIsUsable
    ? null
    : t('purchaseAmountSheet.quantityRequired');

  const handleConfirm = () => {
    if (!quantityIsUsable || parsedQty == null) return;
    onConfirm(parsedQty, parsedTotal);
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      {/* Two inputs and a keyboard can exceed the sheet, and `BottomSheetView`
          is absolutely positioned with no height — anything past the fold is
          unreachable. */}
      <BottomSheetFormScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
      >
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
        <View style={styles.sections}>
          <Text size="lg" weight="semibold" style={styles.itemName}>
            {item?.itemName ?? ''}
          </Text>

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
                {t(
                  item?.unitName
                    ? 'purchaseAmountSheet.perUnitOfHint'
                    : 'purchaseAmountSheet.perUnitHint',
                  {
                    price: formatCurrency(perUnitPrice, DEFAULT_CURRENCY),
                    unit: item?.unitName,
                  },
                )}
              </Text>
            ) : null}
          </View>
        </View>
      </BottomSheetFormScrollView>
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
