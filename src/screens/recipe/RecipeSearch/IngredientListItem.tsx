import React from 'react';
import { Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { createPropsComparator } from '#utils/memoUtils';
import { useIngredientSelector } from './IngredientSelectorContext';

// ── Ingredient list item components (FlashList compatible) ──

const IngredientItemComponent: React.FC<{
  name: string;
  selected: boolean;
  onToggle: (name: string) => void;
  primaryColor: string;
  textSecondary: string;
}> = ({ name, selected, onToggle, primaryColor, textSecondary }) => {
  const handlePress = () => onToggle(name);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ingredientItem,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <Ionicons
        name={selected ? 'checkbox' : 'square-outline'}
        size={24}
        color={selected ? primaryColor : textSecondary}
      />
      <Text style={styles.ingredientText}>{name}</Text>
    </Pressable>
  );
};

const areIngredientItemPropsEqual = createPropsComparator<{
  name: string;
  selected: boolean;
  onToggle: (name: string) => void;
  primaryColor: string;
  textSecondary: string;
}>({
  referenceKeys: ['name', 'selected', 'primaryColor', 'textSecondary'],
});

const IngredientItem = React.memo(
  IngredientItemComponent,
  areIngredientItemPropsEqual,
);

export const ingredientKeyExtractor = (item: any) => item.id;

const IngredientRenderItem = ({ item }: { item: any }) => {
  const { selectedIngredients, toggleIngredient } = useIngredientSelector();
  const { theme } = useUnistyles();
  const itemName = item.itemName || '';
  return (
    <IngredientItem
      name={itemName}
      selected={selectedIngredients.has(itemName)}
      onToggle={toggleIngredient}
      primaryColor={theme.colors.primary}
      textSecondary={theme.colors.textSecondary}
    />
  );
};

export const renderIngredientItem = ({ item }: { item: any }) => (
  <IngredientRenderItem item={item} />
);

const styles = StyleSheet.create(theme => ({
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ingredientText: {
    marginLeft: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
  },
  pressed: { opacity: theme.opacity.pressed },
}));
