import React from 'react';
import { View } from 'react-native';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';
import { MyRecipeCard_RecipeFragmentDoc } from './MyRecipeCard.generated';

interface MyRecipeCardProps {
  recipeRef: FragmentType<typeof MyRecipeCard_RecipeFragmentDoc>;
  onPress: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const MyRecipeCard: React.FC<MyRecipeCardProps> = ({
  recipeRef,
  onPress,
  onEdit,
  onDelete,
}) => {
  // Per-entity cache subscription: this card re-renders only when this Recipe's
  // MyRecipeCard_recipe fields change.
  const { data: recipe, complete } = useFragment({
    fragment: MyRecipeCard_RecipeFragmentDoc,
    fragmentName: 'MyRecipeCard_recipe',
    from: recipeRef,
  });

  if (!complete) return null;

  const totalTime =
    recipe.totalTimeMinutes ??
    (recipe.prepTimeMinutes && recipe.cookTimeMinutes
      ? recipe.prepTimeMinutes + recipe.cookTimeMinutes
      : recipe.prepTimeMinutes ?? recipe.cookTimeMinutes ?? null);

  return (
    <Pressable
      onPress={() => onPress(recipe.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={recipe.name}
    >
      {!!recipe.imageUrl && (
        <View style={commonStyles.listItemImageContainerCompact}>
          <CachedImage
            uri={recipe.imageUrl}
            style={commonStyles.listItemImageCompact}
            displaySize={48}
          />
        </View>
      )}
      <View style={styles.body}>
        <Text size="md" weight="medium" numberOfLines={1}>
          {recipe.name}
        </Text>
        <Text size="sm" tone="secondary" numberOfLines={1}>
          {recipe.servings} servings
          {totalTime != null ? ` • ${totalTime} min` : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        {!!onEdit && (
          <Pressable
            onPress={() => onEdit(recipe.id)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel="Edit recipe"
          >
            <Icon name="create-outline" size={20} tone="textSecondary" />
          </Pressable>
        )}
        {!!onDelete && (
          <Pressable
            onPress={() => onDelete(recipe.id)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel="Delete recipe"
          >
            <Icon name="trash-outline" size={20} tone="error" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
