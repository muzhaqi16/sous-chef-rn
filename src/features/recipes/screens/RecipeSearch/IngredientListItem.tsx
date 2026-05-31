import React from 'react';

import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

import { useIngredientSelector } from './IngredientSelectorContext';
import { Text } from '#components/atoms/Text';

// ── Ingredient list item components (FlashList compatible) ──

const IngredientItemComponent: React.FC<{
  name: string;
  selected: boolean;
  onToggle: (name: string) => void;
}> = ({ name, selected, onToggle }) => {
  const handlePress = () => onToggle(name);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ingredientItem,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <Icon
        name={selected ? 'checkbox' : 'square-outline'}
        size={24}
        tone={selected ? 'primary' : 'textSecondary'}
      />
      <Text size="md" style={styles.ingredientText}>
        {name}
      </Text>
    </Pressable>
  );
};

const IngredientItem = IngredientItemComponent;

/** Minimal shape the ingredient list cell reads from each pantry item. */
interface IngredientListItemData {
  id: string;
  itemName?: string | null;
}

export const ingredientKeyExtractor = (item: IngredientListItemData) => item.id;

const IngredientRenderItem = ({ item }: { item: IngredientListItemData }) => {
  const { selectedIngredients, toggleIngredient } = useIngredientSelector();
  const itemName = item.itemName || '';
  return (
    <IngredientItem
      name={itemName}
      selected={selectedIngredients.has(itemName)}
      onToggle={toggleIngredient}
    />
  );
};

export const renderIngredientItem = ({
  item,
}: {
  item: IngredientListItemData;
}) => <IngredientRenderItem item={item} />;

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
  },
  pressed: { opacity: theme.opacity.pressed },
}));
