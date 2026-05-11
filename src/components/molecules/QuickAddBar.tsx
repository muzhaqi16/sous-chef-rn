import React, { useRef, useState } from 'react';
import { View, TextInput, Keyboard } from 'react-native';
import { Pressable, ThemedTextInput } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';

interface QuickAddBarProps {
  onAddItem: (name: string, quantity: number) => void;
  visible?: boolean;
}

/**
 * Lightweight inline add bar.
 *
 * The TextInputs are uncontrolled (defaultValue + ref) so each keystroke does
 * not trigger a parent re-render. The add button mirrors `itemName` into a
 * separate `hasName` boolean — that's the only thing the JSX needs to react
 * to so the disabled state and accessibility label can update.
 */
export const QuickAddBar: React.FC<QuickAddBarProps> = ({
  onAddItem,
  visible = true,
}) => {
  const nameRef = useRef<TextInput>(null);
  const quantityRef = useRef<TextInput>(null);
  const itemNameRef = useRef('');
  const quantityValueRef = useRef('1');
  const [hasName, setHasName] = useState(false);

  const handleNameChange = (text: string) => {
    itemNameRef.current = text;
    const trimmedHasContent = text.trim().length > 0;
    if (trimmedHasContent !== hasName) {
      setHasName(trimmedHasContent);
    }
  };

  const handleQuantityChange = (text: string) => {
    quantityValueRef.current = text;
  };

  const handleAdd = () => {
    const trimmed = itemNameRef.current.trim();
    if (!trimmed) return;
    const qty = parseInt(quantityValueRef.current) || 1;
    onAddItem(trimmed, qty);

    // Reset inputs
    itemNameRef.current = '';
    quantityValueRef.current = '1';
    nameRef.current?.clear();
    quantityRef.current?.setNativeProps({ text: '1' });
    setHasName(false);
    Keyboard.dismiss();
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <ThemedTextInput
          ref={nameRef}
          style={styles.nameInput}
          placeholder="Add item..."
          defaultValue=""
          onChangeText={handleNameChange}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          accessibilityLabel="Item name"
          accessibilityHint="Enter the name of the item to add"
        />
        <ThemedTextInput
          ref={quantityRef}
          style={styles.quantityInput}
          placeholder="Qty"
          defaultValue="1"
          onChangeText={handleQuantityChange}
          keyboardType="numeric"
          accessibilityLabel="Quantity"
          accessibilityHint="Enter the quantity"
        />
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={handleAdd}
          disabled={!hasName}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          accessibilityHint={hasName ? 'Add to list' : 'Enter item name first'}
          accessibilityState={{ disabled: !hasName }}
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
