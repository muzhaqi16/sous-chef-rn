import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Keyboard } from 'react-native';
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
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAdd}
          disabled={!itemName.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          accessibilityHint={itemName.trim() ? `Add ${itemName} to list` : 'Enter item name first'}
          accessibilityState={{ disabled: !itemName.trim() }}
        >
          <Icon name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    elevation: 2,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    height: 44,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  quantityInput: {
    width: 60,
    height: 44,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
