import React, { useState } from 'react';
import { View, TextInput, Keyboard } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';

interface QuickAddBarProps {
  onAddItem: (name: string, quantity: number) => void;
  visible?: boolean;
}

export const QuickAddBar: React.FC<QuickAddBarProps> = ({
  onAddItem,
  visible = true,
}) => {
  const { theme } = useUnistyles();
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');

  const handleAdd = () => {
    if (itemName.trim()) {
      onAddItem(itemName.trim(), parseInt(quantity) || 1);
      setItemName('');
      setQuantity('1');
      Keyboard.dismiss();
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.nameInput}
          placeholder="Add item..."
          value={itemName}
          onChangeText={setItemName}
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          accessibilityLabel="Item name"
          accessibilityHint="Enter the name of the item to add"
        />
        <TextInput
          style={styles.quantityInput}
          placeholder="Qty"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel="Quantity"
          accessibilityHint="Enter the quantity"
        />
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={handleAdd}
          disabled={!itemName.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          accessibilityHint={
            itemName.trim()
              ? `Add ${itemName} to list`
              : 'Enter item name first'
          }
          accessibilityState={{ disabled: !itemName.trim() }}
        >
          <Icon name="add" size={24} color="white" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  nameInput: {
    flex: 1,
    height: theme.sizes.input.md,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  quantityInput: {
    width: theme.spacing['3xl'] - 4,
    height: theme.sizes.input.md,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  addButton: {
    width: theme.sizes.button.md,
    height: theme.sizes.button.md,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
