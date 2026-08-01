import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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

interface PurchaseAmountSheetItem {
  id: string;
  itemName: string;
  requestedQuantity: number;
  unitName: string | null;
  estimatedPrice: number | null;
}

interface PurchaseAmountSheetProps {
  visible: boolean;
  item: PurchaseAmountSheetItem | null;
  onClose: () => void;
  onConfirm: (quantity: number, price: number | null) => void;
  loading?: boolean;
}

/**
 * Parse a plain numeric input (decimals or whole numbers) to a number.
 * Returns null for empty/invalid/negative input.
 */
const parseNumberInput = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const num = parseFloat(trimmed);
  return isNaN(num) || num < 0 ? null : num;
};

/**
 * Format a price for pre-fill — empty string when unknown so the input renders
 * its placeholder rather than "0".
 */
const formatPrice = (price: number | null): string =>
  price == null ? '' : String(price);

/**
 * PurchaseAmountSheet - Bottom sheet to record the actual purchased amounts.
 *
 * Opens pre-filled with the requested quantity and estimated price when the
 * user marks an unpurchased item as purchased. Confirm records the amounts;
 * Cancel dismisses without purchasing.
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
    keyboardAware: true,
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
      setPriceInput(formatPrice(item.estimatedPrice));
    }
  }

  const handleConfirm = () => {
    const parsedQty = parseNumberInput(quantityInput) ?? 0;
    const parsedPrice = parseNumberInput(priceInput);
    onConfirm(parsedQty, parsedPrice);
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
            disabled: loading,
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
            {t('purchaseAmountSheet.quantity')}
          </Text>
          <View style={styles.inputRow}>
            <ThemedBottomSheetTextInput
              style={styles.input}
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={10}
              accessibilityLabel={t('purchaseAmountSheet.quantity')}
              testID="purchase-quantity-input"
            />
            {item?.unitName ? (
              <Text size="base" tone="secondary" style={styles.affix}>
                {item.unitName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.section}>
          <Text
            size="sm"
            weight="medium"
            tone="secondary"
            style={styles.sectionLabel}
          >
            {t('purchaseAmountSheet.price')}
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
              placeholder={t('purchaseAmountSheet.pricePlaceholder')}
              accessibilityLabel={t('purchaseAmountSheet.price')}
              testID="purchase-price-input"
            />
          </View>
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
  prefix: {
    marginRight: theme.spacing.sm,
  },
}));
