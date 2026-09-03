import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
// The TextInput TYPE comes from RNGH: gorhom's BottomSheetTextInput is typed
// against it, since the sheet coordinates gestures through RNGH.
import { TextInput } from 'react-native-gesture-handler';
import { AppPressable } from '#components/atoms/AppPressable';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Header } from '#/components/molecules/Header';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
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

export const QuantityEditSheet: React.FC<QuantityEditSheetProps> = ({
  visible,
  item,
  onClose,
  onSave,
  loading = false,
}) => {
  const { t } = useTranslation();
  // No snap points: the sheet measures its own content, so the keyboard lift
  // seats it on the keyboard instead of stretching a fixed height up the screen.
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!item,
    onDismiss: onClose,
    snapPoints: [],
    enableDynamicSizing: true,
  });

  const [quantityInput, setQuantityInput] = useState('');
  const [unitName, setUnitName] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

  // Focus state only. The text lives in `quantityInput`, the one value save
  // reads, so typing and saving without leaving the field loses nothing.
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Sorted preferred first, then default, then alphabetically.
  const itemUnits =
    item?.itemUnits?.slice().sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    }) || [];

  // Seed on open / item-id change only (render-time state update); seeding on
  // item-property changes flashes the old values back during a save.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevItemId, setPrevItemId] = useState(item?.id);
  if (visible !== prevVisible || item?.id !== prevItemId) {
    setPrevVisible(visible);
    setPrevItemId(item?.id);
    if (visible && item) {
      const initialInput =
        item.quantityInput || formatQuantity(item.quantity ?? 0);
      setQuantityInput(initialInput);

      // Case-insensitive match against the chips, so "Tbsps" displays as "tbsp".
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
          setUnitName(storedUnit.toLowerCase());
          setUnitId(item.unitId ?? null);
        }
      } else {
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

  // What `+`/`-` step FROM. An empty field steps from zero; unreadable text
  // makes the buttons inert, because stepping it would overwrite what the user
  // typed with a formatted number, with no undo.
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

  const handleUnitChipPress = (unit: ItemUnit) => {
    setUnitName(unit.symbol);
    setUnitId(unit.id);
  };

  const handleQuantityPress = () => {
    setIsEditing(true);
    // Focus after the paint that makes the input focusable.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // No sanitizing while typing — it moves the caret mid-word, and `1 1/4` is
  // only a whole value on its last keystroke. `parsedQuantity` judges it later.
  const handleInputChange = (text: string) => {
    setQuantityInput(text);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    if (quantityInput.trim() === '') {
      setQuantityInput('0');
    }
  };

  const handleSave = () => {
    onSave(quantityInput, unitName, unitId);
  };

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
      {/* `BottomSheetView` reports its own height as the sheet's content
          height, so everything the sheet shows must sit inside this one. */}
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
        {/* The header spans the full width and only the fields are inset, so
          the padding lives here rather than on the measured view. */}
        <View style={styles.sections}>
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
                    // A digits-only pad has no `/` or space, so `1 1/3` could
                    // not be typed. Same keyboard as `FractionInput`.
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

          <View style={styles.section}>
            <Text
              size="sm"
              weight="medium"
              tone="secondary"
              style={styles.sectionLabel}
            >
              {t('storageLocationForm.unit')}
            </Text>

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

            <UnitAutocompleteField
              variant="inline"
              // The sheet is sized to its content, so the absolutely-positioned
              // suggestion list would otherwise open past its bottom edge.
              reserveDropdownSpace
              value={unitName || ''}
              onChangeText={text => {
                setUnitName(text || null);
                setUnitId(null);
              }}
              onUnitSelected={(selectedUnitId, selectedUnitName) => {
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
    borderWidth: theme.borderWidth.hairline,
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
          borderWidth: theme.borderWidth.medium,
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
