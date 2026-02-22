// src/components/molecules/SmartSearchAddBar.tsx
import React, {useState, useRef} from 'react';
import {View, TextInput, Pressable, Text, Keyboard} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#/utils/iconUtils';
import {Counter} from './Counter';

interface SmartSearchAddBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onAddItem: (item: {name: string; quantity: number; unit?: string}) => void;
  placeholder?: string;
  suggestions?: Array<{id: string; name: string}>;
  onSelectSuggestion?: (item: any) => void;
}

export const SmartSearchAddBar: React.FC<SmartSearchAddBarProps> = ({
  value,
  onChangeText,
  onAddItem,
  placeholder = 'Search or add item...',
  suggestions = [],
  onSelectSuggestion,
}) => {
  const {theme} = useUnistyles();
  const [quantity, setQuantity] = useState(1);
  const [showAddControls, setShowAddControls] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleAddPress = () => {
    if (value.trim()) {
      onAddItem({
        name: value.trim(),
        quantity,
      });
      onChangeText('');
      setQuantity(1);
      setShowAddControls(false);
      Keyboard.dismiss();
    }
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setShowAddControls(text.length > 0 && suggestions.length === 0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="done"
          onSubmitEditing={handleAddPress}
        />
        {value.length > 0 && (
          <Pressable
            onPress={() => {
              onChangeText('');
              setShowAddControls(false);
            }}
            style={({pressed}) => [styles.clearButton, pressed && styles.pressed]}>
            <Icon name="close" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {!!showAddControls && (
        <View style={styles.addControls}>
          <Text style={styles.addText}>Add "{value}" to list</Text>
          <View style={styles.quantityRow}>
            <Counter
              count={quantity}
              onIncrement={() => setQuantity(q => q + 1)}
              onDecrement={() => setQuantity(q => Math.max(1, q - 1))}
            />
            <Pressable style={({pressed}) => [styles.addButton, pressed && styles.pressed]} onPress={handleAddPress}>
              <Icon name="add" size={24} color="white" />
            </Pressable>
          </View>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.slice(0, 3).map(item => (
            <Pressable
              key={item.id}
              style={({pressed}) => [styles.suggestionItem, pressed && styles.pressed]}
              onPress={() => onSelectSuggestion?.(item)}>
              <Text style={styles.suggestionText}>{item.name}</Text>
              <Icon
                name="add-circle-outline"
                size={20}
                color={theme.colors.primary}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing['3'],
    height: theme.sizes.input.md - 4,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  addControls: {
    marginTop: theme.spacing['3'],
    padding: theme.spacing['3'],
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.sm,
  },
  addText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    width: theme.sizes.button.md + 4,
    height: theme.sizes.button.md + 4,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestions: {
    marginTop: theme.spacing.sm,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  suggestionText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
