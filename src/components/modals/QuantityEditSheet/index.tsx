import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
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
  const [quantity, setQuantity] = useState(1);
  const [unitName, setUnitName] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

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
      setUnitName(item.unitName ?? null);
      setUnitId(item.unitId ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally skip item prop changes to prevent flash-back
  }, [visible, item?.id]);

  // Handle sheet visibility
  useEffect(() => {
    if (visible && item) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, item]);

  // Handle quantity changes
  const handleIncrement = useCallback(() => {
    setQuantity(prev => prev + 1);
  }, []);

  const handleDecrement = useCallback(() => {
    setQuantity(prev => Math.max(1, prev - 1));
  }, []);

  // Handle unit chip selection
  const handleUnitChipPress = useCallback((unit: ItemUnit) => {
    setUnitName(unit.symbol);
    setUnitId(unit.id);
  }, []);

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
              disabled={quantity <= 1}
              activeOpacity={0.7}
            >
              <Icon
                name="remove"
                size={24}
                color={quantity <= 1 ? theme.colors.textTertiary : theme.colors.textPrimary}
                library="MaterialIcons"
              />
            </TouchableOpacity>

            {/* Quantity Display */}
            <View style={styles.quantityDisplay}>
              <Text style={[styles.quantityText, { color: theme.colors.textPrimary }]}>
                {quantity}
              </Text>
            </View>

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
