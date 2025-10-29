// src/components/molecules/SmartSearchAddBar.tsx
import React, {useState, useRef} from 'react';
import {View, TextInput, TouchableOpacity, Text, Keyboard} from 'react-native';
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
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              setShowAddControls(false);
            }}
            style={styles.clearButton}>
            <Icon name="close" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {showAddControls && (
        <View style={styles.addControls}>
          <Text style={styles.addText}>Add "{value}" to list</Text>
          <View style={styles.quantityRow}>
            <Counter
              count={quantity}
              onIncrement={() => setQuantity(q => q + 1)}
              onDecrement={() => setQuantity(q => Math.max(1, q - 1))}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
              <Icon name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.slice(0, 3).map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionItem}
              onPress={() => onSelectSuggestion?.(item)}>
              <Text style={styles.suggestionText}>{item.name}</Text>
              <Icon
                name="add-circle-outline"
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  clearButton: {
    padding: 4,
  },
  addControls: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
  },
  addText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestions: {
    marginTop: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    marginBottom: 4,
    borderRadius: 8,
  },
  suggestionText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
}));
