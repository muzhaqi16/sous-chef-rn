import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
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
  const { t } = useTranslation();
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
    <AppPressable
      onPress={() => onPress(recipe.id)}
      style={styles.card}
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
          {recipe.servings} {t('recipes.servingsSuffix')}
          {totalTime != null ? ` • ${totalTime} ${t('recipes.minutes')}` : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        {!!onEdit && (
          <Pressable
            onPress={() => onEdit(recipe.id)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel={t('recipes.editRecipeA11y')}
          >
            <Icon name="create-outline" size={20} tone="textSecondary" />
          </Pressable>
        )}
        {!!onDelete && (
          <Pressable
            onPress={() => onDelete(recipe.id)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel={t('recipes.deleteRecipeA11y')}
          >
            <Icon name="trash-outline" size={20} tone="error" />
          </Pressable>
        )}
      </View>
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing['3'],
    // Match the search bar inset so rows line up with it instead of going
    // edge-to-edge — same floating-card treatment as BaseItemCard.
    marginHorizontal: theme.spacing['3'],
    marginBottom: theme.spacing['2.5'],
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
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
