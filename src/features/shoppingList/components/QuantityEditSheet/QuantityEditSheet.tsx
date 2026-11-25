import React, { useState, useRef } from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { SheetHeader } from '#components/templates/SheetHeader';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedTextInput,
  type ThemedTextInputRef,
} from '#components/atoms/themedComponents';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { Chip } from '#components/molecules/Chip';
import {
  formatQuantityForInput,
  unitLabel,
  type UnitLabelSource,
} from '#utils/formatQuantity';
import { Text } from '#components/atoms/Text';
import { parseFractionalInput } from '#utils/fractionUtils';
import { quantityCapMessage } from '#utils/validation/common';
import { MAX_QUANTITY } from '#utils/validation/entryLimits';
import { localizeNumericHint } from '#utils/formatters/number';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useOpening } from '#hooks/ui/useOpening';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

interface ItemUnit {
  id: string;
  /** The unit as the line holds or reads it: its chip, and what the field shows. */
  unit: UnitLabelSource;
  isDefault?: boolean;
  isPreferred?: boolean;
}

// The stored label names the unit as shown, or as the API wrote it ("Tbsps").
const namesUnit = ({ unit }: ItemUnit, text: string): boolean =>
  [unitLabel(unit), unit.symbol, unit.name].some(
    label => !!label && label.toLowerCase() === text.toLowerCase(),
  );

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
  onSave: (quantity: string, unitId: string | null) => void;
  loading?: boolean;
}

/**
 * What the field opens on, in the device's decimal separator. Text no parser
 * reads ("a pinch") stays as the person wrote it.
 */
const seedText = (item: QuantityEditSheetItem): string => {
  const typed = item.quantityInput?.trim();
  const typedValue = typed ? parseFractionalInput(typed) : null;
  if (typed && typedValue === null) return typed;
  return formatQuantityForInput(typedValue ?? item.quantity);
};

/**
 * The unit the line opens on. Matched case-insensitively against the chips,
 * so "Tbsps" shows as "tbsp".
 */
const seedUnit = (
  item: QuantityEditSheetItem,
): { name: string | null; id: string | null } => {
  const storedUnit = item.unitName;
  const matchingUnit = storedUnit
    ? item.itemUnits?.find(u => namesUnit(u, storedUnit))
    : undefined;
  if (matchingUnit) {
    return { name: unitLabel(matchingUnit.unit), id: matchingUnit.id };
  }
  return {
    name: storedUnit ? storedUnit.toLowerCase() : null,
    id: item.unitId ?? null,
  };
};

type QuantityEditContentProps = Omit<
  QuantityEditSheetProps,
  'visible' | 'item'
> & { item: QuantityEditSheetItem };

/** One opening, seeded from the line as it opened. */
const QuantityEditContent: React.FC<QuantityEditContentProps> = ({
  item,
  onClose,
  onSave,
  loading = false,
}) => {
  const { t } = useTranslation();

  const [quantityInput, setQuantityInput] = useState(() => seedText(item));
  const [unitName, setUnitName] = useState(() => seedUnit(item).name);
  const [unitId, setUnitId] = useState(() => seedUnit(item).id);

  // Focus state only. The text lives in `quantityInput`, the one value save
  // reads, so typing and saving without leaving the field loses nothing.
  const [isEditing, setIsEditing] = useState(false);
  // Set by a save the quantity refused; cleared once the field reads.
  const [refused, setRefused] = useState(false);
  const inputRef = useRef<ThemedTextInputRef>(null);

  // Sorted preferred first, then default, then alphabetically.
  const itemUnits =
    item.itemUnits?.slice().sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return unitLabel(a.unit).localeCompare(unitLabel(b.unit));
    }) ?? [];

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
      formatQuantityForInput(newValue, {
        notation: quantityInput.includes('/') ? 'mixed' : 'decimal',
      }),
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

  const handleUnitChipPress = (chip: ItemUnit) => {
    setUnitName(unitLabel(chip.unit));
    setUnitId(chip.id);
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

  const hasChanges =
    quantityInput !== seedText(item) || unitName !== item.unitName;
  useSheetUnsavedInput(hasChanges);

  // The server parses this string itself and rejects anything it can't read,
  // which offline would surface only once the queue replayed. Catch it here.
  // A list line holds more than nothing, and no more than the API's cap.
  const overCap = parsedQuantity !== null && parsedQuantity > MAX_QUANTITY;
  const quantityIsValid =
    parsedQuantity !== null && parsedQuantity > 0 && !overCap;

  // Never greyed out: a quantity it cannot read is said on the field, and
  // nothing changed has nothing to save.
  const handleSave = () => {
    if (!quantityIsValid) {
      setRefused(true);
      return;
    }
    if (!hasChanges) {
      onClose();
      return;
    }
    onSave(quantityInput, unitId);
  };

  // Both buttons refuse the same state, rather than `-` refusing it and `+`
  // silently rewriting the field.
  const decrementDisabled = stepDisabled || stepBase <= 0;

  const variantStyles = styles.useVariants({ editing: isEditing });

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('quantityEditSheet.title')}
          onClose={onClose}
          confirm={{
            onPress: handleSave,
            loading,
            testID: shoppingListTestIDs.quantityEditSaveButton,
          }}
        />
      </SheetHeaderSlot>
      {/* The header spans the full width and only the fields are inset, so
          the padding lives here rather than on the measured view. */}
      <View style={variantStyles.sections}>
        <View style={variantStyles.section}>
          <Text
            role="label"
            tone="secondary"
            style={variantStyles.sectionLabel}
          >
            {t('labels.quantity')}
          </Text>
          <View style={variantStyles.counterContainer}>
            <IconButton
              name="remove-outline"
              size="md"
              tone={decrementDisabled ? 'textTertiary' : 'textPrimary'}
              onPress={handleDecrement}
              accessibilityLabel={t('editableCounter.decrease')}
              disabled={decrementDisabled}
              testID={shoppingListTestIDs.quantityEditDecrement}
              style={variantStyles.counterButton}
            />

            <AppPressable
              testID={shoppingListTestIDs.quantityEditValue}
              style={variantStyles.quantityDisplay}
              onPress={handleQuantityPress}
            >
              {isEditing ? (
                <ThemedTextInput
                  ref={inputRef}
                  style={variantStyles.quantityInput}
                  value={quantityInput}
                  onChangeText={handleInputChange}
                  onBlur={handleInputBlur}
                  // A digits-only pad has no `/` or space, so `1 1/3` could
                  // not be typed. Same keyboard as `FractionInput`.
                  keyboardType="numbers-and-punctuation"
                  selectTextOnFocus
                  maxLength={10}
                  testID={shoppingListTestIDs.quantityEditInput}
                />
              ) : (
                <Text role="display">{quantityInput || '0'}</Text>
              )}
            </AppPressable>

            <IconButton
              name="add"
              size="md"
              tone="onPrimary"
              onPress={handleIncrement}
              accessibilityLabel={t('editableCounter.increase')}
              disabled={stepDisabled}
              testID={shoppingListTestIDs.quantityEditIncrement}
              style={variantStyles.incrementButton}
            />
          </View>
          {refused && !quantityIsValid ? (
            <Text
              role="error"
              tone="error"
              align="center"
              style={variantStyles.quantityHint}
              testID={shoppingListTestIDs.quantityEditError}
            >
              {overCap ? quantityCapMessage() : t('errors.invalidQuantity')}
            </Text>
          ) : null}
          {/* An empty field is "nothing typed yet", not a malformed quantity. */}
          {quantityInput.trim() !== '' && !quantityIsValid && (
            <Text
              role="error"
              tone="error"
              align="center"
              style={variantStyles.quantityHint}
              testID={shoppingListTestIDs.quantityEditFormatHint}
            >
              {localizeNumericHint(t('fractionInput.formatsHint'))}
            </Text>
          )}
        </View>

        <View style={variantStyles.section}>
          <SectionHeader variant="overline" style={variantStyles.sectionLabel}>
            {t('labels.unit')}
          </SectionHeader>

          {itemUnits.length > 0 && (
            <View style={variantStyles.chipsContainer}>
              {itemUnits.map(chip => (
                <Chip
                  key={chip.id}
                  label={unitLabel(chip.unit)}
                  selected={unitName === unitLabel(chip.unit)}
                  onPress={() => handleUnitChipPress(chip)}
                />
              ))}
            </View>
          )}

          <UnitAutocompleteField
            variant="inline"
            // The sheet is sized to its content, so the absolutely-positioned
            // suggestion list would otherwise open past its bottom edge.
            reserveDropdownSpace
            value={unitName ?? ''}
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
    </>
  );
};

export const QuantityEditSheet: React.FC<QuantityEditSheetProps> = ({
  visible,
  item,
  ...content
}) => {
  const open = visible && item !== null;
  const opening = useOpening(open, item);
  // The line now, or while closing the one it opened on. A new line seeds a
  // fresh form; a change to the same line, as a save lands, leaves what is
  // typed.
  const shown = item ?? opening?.payload;

  // No snap points: the sheet measures its own content, so the keyboard lift
  // seats it on the keyboard instead of stretching a fixed height up the
  // screen. `view`: a content-sized sheet takes no keyboard-aware scrollable.
  return (
    <Sheet
      mode="view"
      headerFromContent
      visible={open}
      onDismiss={content.onClose}
      snapPoints={[]}
      enableDynamicSizing
      contentContainerStyle={styles.content}
    >
      {opening && shown ? (
        <QuantityEditContent
          key={`${opening.id}:${shown.id}`}
          item={shown}
          {...content}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.sm,
  },
  sections: {
    paddingHorizontal: theme.spacing.md,
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
}));
