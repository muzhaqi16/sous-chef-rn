import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import type { SavedRecipeNode } from '#features/recipes/hooks/useSavedRecipes';
import { SavedRecipeRow_SavedRecipeFragmentDoc } from './SavedRecipeRow.generated';

interface SavedRecipeRowProps {
  savedRecipeRef: SavedRecipeNode;
  onPress: (recipeId: string) => void;
}

/**
 * One saved recipe in the add-meal sheet, read through its own fragment so it
 * stays independent of the recipes feature's internals. Search filtering is
 * the PARENT's job — a row rendering `null` still occupies a slot in the
 * list's item count and leaves a blank gap.
 */
export const SavedRecipeRow: React.FC<SavedRecipeRowProps> = ({
  savedRecipeRef,
  onPress,
}) => {
  const { t } = useTranslation();
  const { data, complete } = useFragment({
    fragment: SavedRecipeRow_SavedRecipeFragmentDoc,
    fragmentName: 'SavedRecipeRow_savedRecipe',
    from: savedRecipeRef,
  });

  if (!complete) return null;

  const { recipe } = data;
  return (
    <AppPressable onPress={() => onPress(recipe.id)} style={styles.recipeItem}>
      {!!recipe.imageUrl && (
        <CachedImage
          uri={recipe.imageUrl}
          style={styles.recipeImage}
          displaySize={44}
        />
      )}
      <View style={styles.recipeInfo}>
        <Text role="bodyStrong" numberOfLines={1}>
          {recipe.name}
        </Text>
        {!!(recipe.servings || recipe.totalTimeMinutes) && (
          <Text role="caption" tone="secondary" style={styles.recipeMeta}>
            {recipe.servings
              ? t('addMealSheet.servings', { count: recipe.servings })
              : ''}
            {recipe.totalTimeMinutes
              ? `${recipe.servings ? ' · ' : ''}${t('labels.min', {
                  count: recipe.totalTimeMinutes,
                })}`
              : ''}
          </Text>
        )}
      </View>
      <Icon name="add-circle-outline" size={24} tone="primary" />
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  recipeImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
  },
  recipeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  recipeMeta: {
    marginTop: theme.spacing['2xs'],
  },
}));
