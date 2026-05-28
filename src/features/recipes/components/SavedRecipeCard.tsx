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
import { SavedRecipeCard_SavedRecipeFragmentDoc } from './SavedRecipeCard.generated';

interface SavedRecipeCardProps {
  savedRecipeRef: FragmentType<typeof SavedRecipeCard_SavedRecipeFragmentDoc>;
  onPress: (recipeId: string) => void;
  onRemove?: (recipeId: string) => void;
}

export const SavedRecipeCard: React.FC<SavedRecipeCardProps> = ({
  savedRecipeRef,
  onPress,
  onRemove,
}) => {
  // Per-entity cache subscription: re-renders only when this SavedRecipe (or
  // its nested recipe scalars) change in the cache.
  const { data: saved, complete } = useFragment({
    fragment: SavedRecipeCard_SavedRecipeFragmentDoc,
    fragmentName: 'SavedRecipeCard_savedRecipe',
    from: savedRecipeRef,
  });

  if (!complete) return null;
  const recipe = saved.recipe;

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
      {!!onRemove && (
        <Pressable
          onPress={() => onRemove(recipe.id)}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityLabel="Remove from saved"
        >
          <Icon name="trash-outline" size={20} tone="error" />
        </Pressable>
      )}
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
