import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { InlineUnitsAutocomplete } from '#/components/molecules/InlineUnitsAutocomplete';
import Chip from '#/components/atoms/Chip';
import { Icon } from '#utils';

interface ItemUnit {
  id: string;
  symbol: string;
  name: string;
  isDefault?: boolean;
  isPreferred?: boolean;
}

interface QuantityEditSheetItem {
  id: string;
  itemName: string;
  quantity: number;
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
  onSave: (quantity: number, unitName: string | null, unitId: string | null) => void;
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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  // Local state for editing
  const [quantity, setQuantity] = useState(0);
  const [unitName, setUnitName] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

  // Edit mode state for direct quantity input
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Use item-specific units if available (sorted: preferred first, then default, then alphabetically)
  const itemUnits = item?.itemUnits?.slice().sort((a, b) => {
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  }) || [];

  // Initialize state only when sheet opens or item ID changes
  // NOT when item properties change (to prevent flash-back during save)
  useEffect(() => {
    if (visible && item) {
      setQuantity(item.quantity ?? 0);

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

  // Handle sheet visibility
  useEffect(() => {
    if (visible && item) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
      // Reset edit mode when sheet closes
      setIsEditing(false);
    }
  }, [visible, item]);

  // Format quantity for display (max 2 decimal places, no trailing zeros)
  const formatQuantity = useCallback((value: number): string => {
    const rounded = Math.round(value * 100) / 100;
    if (rounded % 1 === 0) {
      return rounded.toString();
    }
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  }, []);

  // Handle quantity changes (with hybrid mode support)
  const handleIncrement = useCallback(() => {
    setQuantity(prev => {
      const newValue = prev + 1;
      if (isEditing) {
        setInputValue(formatQuantity(newValue));
      }
      return newValue;
    });
  }, [isEditing, formatQuantity]);

  const handleDecrement = useCallback(() => {
    setQuantity(prev => {
      const newValue = Math.max(0, prev - 1);
      if (isEditing) {
        setInputValue(formatQuantity(newValue));
      }
      return newValue;
    });
  }, [isEditing, formatQuantity]);

  // Handle unit chip selection
  const handleUnitChipPress = useCallback((unit: ItemUnit) => {
    setUnitName(unit.symbol);
    setUnitId(unit.id);
  }, []);

  // Handle tap on quantity to enter edit mode
  const handleQuantityPress = useCallback(() => {
    setInputValue(formatQuantity(quantity));
    setIsEditing(true);
    // Focus after state update
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [quantity, formatQuantity]);

  // Handle input text change - no sanitization to avoid cursor jumping
  // Validation happens on blur instead
  const handleInputChange = useCallback((text: string) => {
    setInputValue(text);
  }, []);

  // Handle input blur - validate and update quantity
  const handleInputBlur = useCallback(() => {
    setIsEditing(false);

    if (inputValue.trim() === '') {
      // Empty input becomes 0
      setQuantity(0);
      return;
    }

    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      // Invalid input - revert to current quantity (already in state)
      return;
    }

    // Round to 2 decimal places and clamp to min 0
    const rounded = Math.round(Math.max(0, parsed) * 100) / 100;
    setQuantity(rounded);
  }, [inputValue]);

  // Handle save
  const handleSave = useCallback(() => {
    onSave(quantity, unitName, unitId);
  }, [quantity, unitName, unitId, onSave]);

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  // Check if values changed
  const hasChanges =
    item && (quantity !== item.quantity || unitName !== item.unitName);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        {/* Item Header */}
        {item && (
          <View style={styles.header}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.itemImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Icon
                  name="shopping-cart"
                  size={24}
                  color={theme.colors.textSecondary}
                  library="MaterialIcons"
                />
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={[styles.itemName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {item.itemName}
              </Text>
              {item.category && (
                <Text style={[styles.category, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {item.category}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Quantity Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Quantity
          </Text>
          <View style={styles.counterContainer}>
            {/* Decrement Button */}
            <TouchableOpacity
              style={[styles.counterButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={handleDecrement}
              disabled={quantity <= 0}
              activeOpacity={0.7}
            >
              <Icon
                name="remove"
                size={24}
                color={quantity <= 0 ? theme.colors.textTertiary : theme.colors.textPrimary}
                library="MaterialIcons"
              />
            </TouchableOpacity>

            {/* Quantity Display - Tappable for direct input */}
            <TouchableOpacity
              style={[
                styles.quantityDisplay,
                isEditing && styles.quantityDisplayEditing,
                isEditing && { borderColor: theme.colors.primary },
              ]}
              onPress={handleQuantityPress}
              activeOpacity={0.8}
            >
              {isEditing ? (
                <TextInput
                  ref={inputRef}
                  style={[styles.quantityInput, { color: theme.colors.textPrimary }]}
                  value={inputValue}
                  onChangeText={handleInputChange}
                  onBlur={handleInputBlur}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  maxLength={10}
                />
              ) : (
                <Text style={[styles.quantityText, { color: theme.colors.textPrimary }]}>
                  {formatQuantity(quantity)}
                </Text>
              )}
            </TouchableOpacity>

            {/* Increment Button */}
            <TouchableOpacity
              style={[styles.counterButton, styles.incrementButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleIncrement}
              activeOpacity={0.7}
            >
              <Icon
                name="add"
                size={24}
                color={theme.colors.white}
                library="MaterialIcons"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Unit Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Unit
          </Text>

          {/* Item-specific Units Chips - only show if available */}
          {itemUnits.length > 0 && (
            <View style={styles.chipsContainer}>
              {itemUnits.map(unit => (
                <Chip
                  key={unit.id}
                  label={unit.symbol}
                  selected={unitName === unit.symbol}
                  onPress={() => handleUnitChipPress(unit)}
                />
              ))}
            </View>
          )}

          {/* Autocomplete for custom/search */}
          <InlineUnitsAutocomplete
            value={unitName || ''}
            onChangeText={(text) => {
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
            placeholder={itemUnits.length > 0 ? 'Or type to search...' : 'Type to search units...'}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.primary },
            (!hasChanges || loading) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || loading}
          activeOpacity={0.8}
        >
          <Text style={[styles.saveButtonText, { color: theme.colors.white }]}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
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
  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  itemName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontSize: 40,
    fontWeight: '600',
  },
  quantityDisplayEditing: {
    borderWidth: 2,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
  },
  quantityInput: {
    fontSize: 40,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  saveButton: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
}));
