import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Keyboard } from 'react-native';
import { TextInput } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { CachedImage } from '#components/atoms/CachedImage';
import { StyleSheet } from 'react-native-unistyles';
import { UnitAutocompleteField } from '#/components/molecules/AutocompleteField/UnitAutocompleteField';
import Chip from '#/components/atoms/Chip';
import { Icon } from '#utils/iconUtils';
import { formatQuantity } from '#/utils/formatQuantity';

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
 * Parse fractional quantity input to a number
 * Supports: decimals (1.5), simple fractions (1/4), mixed numbers (1 1/4)
 */
const parseFractionInput = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Mixed number: "1 1/4"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    if (denominator === 0) return null;
    return whole + numerator / denominator;
  }

  // Simple fraction: "1/4"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  // Decimal or whole number
  const num = parseFloat(trimmed);
  return isNaN(num) || num < 0 ? null : num;
};

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
  const { ref, modalProps, theme } = useStandardBottomSheet({
    visible: visible && !!item,
    onDismiss: onClose,
    snapPoints: ['55%', '95%'],
  });

  // Snap back to initial position when keyboard dismisses
  // keyboardBlurBehavior="restore" is unreliable with "extend", so handle manually
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (visible) {
        ref.current?.snapToIndex(0);
      }
    });
    return () => sub.remove();
  }, [visible, ref]);

  // Local state for editing
  const [quantityInput, setQuantityInput] = useState('');
  const [unitName, setUnitName] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

  // Edit mode state for direct quantity input
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Use item-specific units if available (sorted: preferred first, then default, then alphabetically)
  const itemUnits =
    item?.itemUnits?.slice().sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    }) || [];

  // Initialize state only when sheet opens or item ID changes
  // NOT when item properties change (to prevent flash-back during save)
  useEffect(() => {
    if (visible && item) {
      // Initialize from quantityInput (user's original input) or fall back to formatted quantity
      const initialInput = item.quantityInput || formatQuantity(item.quantity ?? 0);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally skip item prop changes to prevent flash-back
  }, [visible, item?.id]);

  useEffect(() => {
    if (!visible || !item) {
      setIsEditing(false);
    }
  }, [visible, item]);

  // Handle quantity changes (with hybrid mode support)
  const handleIncrement = useCallback(() => {
    const parsed = parseFractionInput(quantityInput) ?? 0;
    const newValue = parsed + 1;
    const formatted = formatQuantity(newValue);
    setQuantityInput(formatted);
    if (isEditing) {
      setInputValue(formatted);
    }
  }, [quantityInput, isEditing]);

  const handleDecrement = useCallback(() => {
    const parsed = parseFractionInput(quantityInput) ?? 0;
    const newValue = Math.max(0, parsed - 1);
    const formatted = formatQuantity(newValue);
    setQuantityInput(formatted);
    if (isEditing) {
      setInputValue(formatted);
    }
  }, [quantityInput, isEditing]);

  // Handle unit chip selection
  const handleUnitChipPress = useCallback((unit: ItemUnit) => {
    setUnitName(unit.symbol);
    setUnitId(unit.id);
  }, []);

  // Handle tap on quantity to enter edit mode
  const handleQuantityPress = useCallback(() => {
    setInputValue(quantityInput);
    setIsEditing(true);
    // Focus after state update
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [quantityInput]);

  // Handle input text change - no sanitization to avoid cursor jumping
  // Validation happens on blur instead
  const handleInputChange = useCallback((text: string) => {
    setInputValue(text);
  }, []);

  // Handle input blur - update quantityInput (validation happens on save by server)
  const handleInputBlur = useCallback(() => {
    setIsEditing(false);

    if (inputValue.trim() === '') {
      // Empty input becomes 0
      setQuantityInput('0');
    } else {
      // Keep whatever the user typed - validation happens on save
      setQuantityInput(inputValue);
    }
  }, [inputValue]);

  // Handle save
  const handleSave = useCallback(() => {
    onSave(quantityInput, unitName, unitId);
  }, [quantityInput, unitName, unitId, onSave]);

  // Check if values changed
  const originalQuantityInput = item?.quantityInput || formatQuantity(item?.quantity ?? 0);
  const hasChanges =
    item && (quantityInput !== originalQuantityInput || unitName !== item.unitName);

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetKeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        {/* Item Header */}
        {!!item && (
          <View style={styles.header}>
            {!!item.imageUrl && (
              <CachedImage
                uri={item.imageUrl}
                style={styles.itemImage}
                displaySize={56}
              />
            )}
            <View style={styles.headerText}>
              <Text
                style={[styles.itemName, { color: theme.colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.itemName}
              </Text>
              {!!item.category && (
                <Text
                  style={[
                    styles.category,
                    { color: theme.colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {item.category}
                </Text>
              )}
            </View>
            <Pressable
              onPress={handleSave}
              disabled={!hasChanges || loading}
              style={({pressed}) => [
                styles.saveLink,
                (!hasChanges || loading) && styles.saveLinkDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.saveLinkText, { color: theme.colors.primary }]}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Quantity Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            Quantity
          </Text>
          <View style={styles.counterContainer}>
            {/* Decrement Button */}
            <Pressable
              style={({pressed}) => [
                styles.counterButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
              onPress={handleDecrement}
              disabled={(parseFractionInput(quantityInput) ?? 0) <= 0}
            >
              <Icon
                name="remove-outline"
                size={24}
                color={
                  (parseFractionInput(quantityInput) ?? 0) <= 0
                    ? theme.colors.textTertiary
                    : theme.colors.textPrimary
                }
              />
            </Pressable>

            {/* Quantity Display - Tappable for direct input */}
            <Pressable
              style={({pressed}) => [
                styles.quantityDisplay,
                isEditing && styles.quantityDisplayEditing,
                isEditing && { borderColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              onPress={handleQuantityPress}
            >
              {isEditing ? (
                <BottomSheetTextInput
                  ref={inputRef}
                  style={[
                    styles.quantityInput,
                    { color: theme.colors.textPrimary },
                  ]}
                  value={inputValue}
                  onChangeText={handleInputChange}
                  onBlur={handleInputBlur}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  maxLength={10}
                />
              ) : (
                <Text
                  style={[
                    styles.quantityText,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  {quantityInput || '0'}
                </Text>
              )}
            </Pressable>

            {/* Increment Button */}
            <Pressable
              style={({pressed}) => [
                styles.counterButton,
                styles.incrementButton,
                { backgroundColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              onPress={handleIncrement}
            >
              <Icon
                name="add"
                size={24}
                color={theme.colors.white}
              />
            </Pressable>
          </View>
        </View>

        {/* Unit Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            Unit
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
                ? 'Or type to search...'
                : 'Type to search units...'
            }
          />
        </View>

      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
  },
  headerText: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  itemName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
  },
  category: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  divider: {
    height: 1,
    marginBottom: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  incrementButton: {
    borderWidth: 0,
  },
  quantityDisplay: {
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  quantityText: {
    fontSize: theme.typography.fontSize['5xl'],
    fontWeight: theme.fonts.weight.semibold,
  },
  quantityDisplayEditing: {
    borderWidth: 2,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
  },
  quantityInput: {
    fontSize: theme.typography.fontSize['5xl'],
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  saveLink: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  saveLinkDisabled: {
    opacity: 0.4,
  },
  saveLinkText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
