import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
// TextInput type comes from RNGH because @gorhom/bottom-sheet's
// BottomSheetTextInput is typed against RNGH's TextInput (it uses RNGH
// internally for gesture coordination inside the sheet).
import { TextInput } from 'react-native-gesture-handler';
import { AppPressable } from '#components/atoms/AppPressable';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Header } from '#/components/molecules/Header';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { UnitAutocompleteField } from '#/components/molecules/AutocompleteField/UnitAutocompleteField';
import Chip from '#/components/atoms/Chip';
import { Icon } from '#utils/iconUtils';
import {
  formatQuantity,
  formatQuantityAsFraction,
} from '#/utils/formatQuantity';
import { Text } from '#components/atoms/Text';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { localizeNumericHint } from '#/utils/formatters/number';

interface ItemUnit {
  id: string;
  symbol: string;
  name: string;
  isDefault?: boolean;
  isPreferred?: boolean;
  // Item-specific unit display names for better UX
  displayNameSingular?: string | null;
  displayNamePlural?: string | null;
}

interface QuantityEditSheetItem {
  id: string;
  itemName: string;
  quantity: number;
  quantityInput?: string | null;
  unitName?: string | null;
  unitId?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  version: number;
  itemUnits?: ItemUnit[];
}

interface QuantityEditSheetProps {
  visible: boolean;
  item: QuantityEditSheetItem | null;
  onClose: () => void;
  onSave: (
    quantity: string,
    unitName: string | null,
    unitId: string | null,
  ) => void;
  loading?: boolean;
}

/**
 * QuantityEditSheet - Bottom sheet for editing item quantity and unit
 *
 * Layout:
 * - Header: Item name + category
 * - Quantity: Label + Large counter (+/-)
 * - Unit: Label + Chip selector
 * - Footer: "Save Changes" button
 */
export const QuantityEditSheet: React.FC<QuantityEditSheetProps> = ({
  visible,
  item,
  onClose,
  onSave,
  loading = false,
}) => {
  const { t } = useTranslation();
  // No snap points: the sheet measures its own content, so the keyboard lift
  // seats that content directly on top of the keyboard instead of stretching a
  // fixed-height sheet up the screen and leaving the difference blank.
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!item,
    onDismiss: onClose,
    snapPoints: [],
    enableDynamicSizing: true,
  });

  // Local state for editing
  const [quantityInput, setQuantityInput] = useState('');
  const [unitName, setUnitName] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

  // Whether the large number is currently a focused text field. The typed text
  // itself lives in `quantityInput` — the single value the save button reads —
  // so a quantity typed and saved without leaving the field is not lost.
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Use item-specific units if available (sorted: preferred first, then default, then alphabetically)
  const itemUnits =
    item?.itemUnits?.slice().sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    }) || [];

  // Initialize state only when sheet opens or item ID changes (render-time state update)
  // NOT when item properties change (to prevent flash-back during save)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevItemId, setPrevItemId] = useState(item?.id);
  if (visible !== prevVisible || item?.id !== prevItemId) {
    setPrevVisible(visible);
    setPrevItemId(item?.id);
    if (visible && item) {
      // Initialize from quantityInput (user's original input) or fall back to formatted quantity
      const initialInput =
        item.quantityInput || formatQuantity(item.quantity ?? 0);
      setQuantityInput(initialInput);

      // Sync unit with available item units (case-insensitive match)
      // This ensures consistent display (e.g., "Tbsps" -> "tbsp" if chip exists)
      const storedUnit = item.unitName;
      if (storedUnit && item.itemUnits && item.itemUnits.length > 0) {
        const matchingUnit = item.itemUnits.find(
          u =>
            u.symbol.toLowerCase() === storedUnit.toLowerCase() ||
            u.name.toLowerCase() === storedUnit.toLowerCase(),
        );
        if (matchingUnit) {
          setUnitName(matchingUnit.symbol);
          setUnitId(matchingUnit.id);
        } else {
          // No matching chip - use lowercase of stored value
          setUnitName(storedUnit.toLowerCase());
          setUnitId(item.unitId ?? null);
        }
      } else {
        // No item units available - use lowercase of stored value
        setUnitName(storedUnit ? storedUnit.toLowerCase() : null);
        setUnitId(item.unitId ?? null);
      }
    } else {
      setIsEditing(false);
    }
  }

  // Stepping keeps the notation the quantity is already written in, so a
  // half-typed `1 1/4` does not come back from the + button as `2.25`.
  const parsedQuantity = parseFractionalInput(quantityInput);

  // What `+`/`-` step FROM. An empty field is "nothing typed yet", so it steps
  // from zero — tapping `+` on a blank field giving 1 is the point of the
  // control. Text that is present but unreadable is different: stepping it
  // would overwrite what the user typed with a formatted number and lose it,
  // with no undo. So the buttons go inert instead, which is also what the
  // format hint below is already telling them.
  const stepBase = quantityInput.trim() === '' ? 0 : parsedQuantity;
  const stepDisabled = stepBase === null;

  const stepTo = (newValue: number) => {
    setQuantityInput(
      quantityInput.includes('/')
        ? formatQuantityAsFraction(newValue)
        : formatQuantity(newValue),
    );
  };

  const handleIncrement = () => {
    if (stepBase === null) return;
    stepTo(stepBase + 1);
  };

  const handleDecrement = () => {
    if (stepBase === null) return;
    stepTo(Math.max(0, stepBase - 1));
  };

  // Handle unit chip selection
  const handleUnitChipPress = (unit: ItemUnit) => {
    setUnitName(unit.symbol);
    setUnitId(unit.id);
  };

  // Handle tap on quantity to enter edit mode
  const handleQuantityPress = () => {
    setIsEditing(true);
    // Focus after render paint when input is focusable
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // No sanitization while typing — that moves the caret mid-word. `1 1/4` and
  // `2 1/3` are only whole values on the last keystroke, so what is typed is
  // kept as typed and `parsedQuantity` decides whether it can be saved.
  const handleInputChange = (text: string) => {
    setQuantityInput(text);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    if (quantityInput.trim() === '') {
      setQuantityInput('0');
    }
  };

  // Handle save
  const handleSave = () => {
    onSave(quantityInput, unitName, unitId);
  };

  // Check if values changed
  const originalQuantityInput =
    item?.quantityInput || formatQuantity(item?.quantity ?? 0);
  const hasChanges =
    item &&
    (quantityInput !== originalQuantityInput || unitName !== item.unitName);

  // The server parses this string itself and rejects anything it can't read,
  // which offline would surface only once the queue replayed. Catch it here.
  const quantityIsValid = parsedQuantity !== null && parsedQuantity >= 0;

  // Both buttons refuse the same state, rather than `-` refusing it and `+`
  // silently rewriting the field.
  const decrementDisabled = stepDisabled || stepBase <= 0;

  styles.useVariants({ editing: isEditing });

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      {/* One measured container: `BottomSheetView` reports its own height as
          the sheet's content height, so everything the sheet shows — header
          included — has to sit inside it. */}
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        <Header
          title={t('quantityEditSheet.title')}
          centerTitle
          onClose={onClose}
          rightActions={[
            {
              icon: 'checkmark',
              onPress: handleSave,
              variant: 'primary',
              disabled: !hasChanges || !quantityIsValid || loading,
              loading: loading,
              testID: 'quantity-edit-save',
            },
          ]}
        />
        <View style={styles.headerSpacer} />
        {/* The header spans the sheet's full width; only the fields below it are
          inset, so the padding lives here rather than on the measured view. */}
        <View style={styles.sections}>
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
            <View style={styles.counterContainer}>
              {/* Decrement Button */}
              <AppPressable
                testID="quantity-edit-decrement"
                style={styles.counterButton}
                onPress={handleDecrement}
                disabled={decrementDisabled}
              >
                <Icon
                  name="remove-outline"
                  size={24}
                  tone={decrementDisabled ? 'textTertiary' : 'textPrimary'}
                />
              </AppPressable>

              {/* Quantity Display - Tappable for direct input */}
              <AppPressable
                testID="quantity-edit-value"
                style={styles.quantityDisplay}
                onPress={handleQuantityPress}
              >
                {isEditing ? (
                  <ThemedBottomSheetTextInput
                    ref={inputRef}
                    style={styles.quantityInput}
                    value={quantityInput}
                    onChangeText={handleInputChange}
                    onBlur={handleInputBlur}
                    // A digits-only pad has no `/` and no space, so `1/4` and
                    // `2 1/3` — quantities the server accepts — could not be
                    // typed at all. Same keyboard as `FractionInput`.
                    keyboardType="numbers-and-punctuation"
                    selectTextOnFocus
                    maxLength={10}
                    testID="quantity-edit-input"
                  />
                ) : (
                  <Text size="5xl" weight="semibold">
                    {quantityInput || '0'}
                  </Text>
                )}
              </AppPressable>

              {/* Increment Button */}
              <AppPressable
                testID="quantity-edit-increment"
                style={styles.incrementButton}
                onPress={handleIncrement}
                disabled={stepDisabled}
              >
                <Icon name="add" size={24} tone="white" />
              </AppPressable>
            </View>
            {/* An empty field is "nothing typed yet", not a malformed quantity —
              the save button is disabled either way. */}
            {quantityInput.trim() !== '' && !quantityIsValid && (
              <Text
                size="sm"
                tone="error"
                align="center"
                style={styles.quantityHint}
                testID="quantity-edit-format-hint"
              >
                {localizeNumericHint(t('fractionInput.formatsHint'))}
              </Text>
            )}
          </View>

          {/* Unit Section */}
          <View style={styles.section}>
            <Text
              size="sm"
              weight="medium"
              tone="secondary"
              style={styles.sectionLabel}
            >
              {t('storageLocationForm.unit')}
            </Text>

            {/* Item-specific Units Chips - only show if available */}
            {/* Use displayNamePlural for better UX (e.g., "pineapples" instead of "count") */}
            {itemUnits.length > 0 && (
              <View style={styles.chipsContainer}>
                {itemUnits.map(unit => (
                  <Chip
                    key={unit.id}
                    label={unit.displayNamePlural || unit.symbol}
                    selected={unitName === unit.symbol}
                    onPress={() => handleUnitChipPress(unit)}
                  />
                ))}
              </View>
            )}

            {/* Autocomplete for custom/search */}
            <UnitAutocompleteField
              variant="inline"
              // The sheet is sized to its content, so the absolutely-positioned
              // suggestion list would otherwise open past its bottom edge.
              reserveDropdownSpace
              value={unitName || ''}
              onChangeText={text => {
                // Convert empty string to null to properly clear the unit
                setUnitName(text || null);
                // Clear unitId when user types custom text
                setUnitId(null);
              }}
              onUnitSelected={(selectedUnitId, selectedUnitName) => {
                // Only update unitName when a unit is actually selected, not when clearing
                if (selectedUnitName !== null) {
                  setUnitName(selectedUnitName);
                }
                setUnitId(selectedUnitId);
              }}
              placeholder={
                itemUnits.length > 0
                  ? t('quantityEditSheet.orTypeToSearch')
                  : t('labels.typeToSearchUnits')
              }
            />
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
  sections: {
    paddingHorizontal: theme.spacing.lg,
  },
  headerSpacer: {
    height: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButton: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  incrementButton: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  quantityDisplay: {
    minWidth: 80,
    // A mixed number is several times wider than a digit; shrink rather than
    // push the +/- buttons off the edge of a narrow screen.
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    variants: {
      editing: {
        true: {
          borderWidth: 2,
          borderRadius: theme.radii.md,
          borderCurve: 'continuous',
          paddingVertical: theme.spacing.xs,
          marginHorizontal: theme.spacing.md,
          borderColor: theme.colors.primary,
        },
      },
    },
  },
  quantityHint: {
    marginTop: theme.spacing.sm,
  },
  quantityInput: {
    fontSize: theme.typography.fontSize['5xl'],
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
    color: theme.colors.textPrimary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
