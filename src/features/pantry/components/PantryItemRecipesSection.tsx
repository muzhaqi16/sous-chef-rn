import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { DetailSection } from '#components/molecules/DetailSection';
import { HorizontalRail } from '#components/molecules/HorizontalRail';
import { DataStateView } from '#components/organisms/DataStateView';
import { catalogKey } from '#domain/catalogRecipes';
import { useRecipeSuggestionsForItem } from '#features/pantry/hooks/useRecipeSuggestionsForItem';
import { catalogHintOf } from '#features/recipes/hooks/useOpenCatalogRecipe';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

/** Recipes that use the item, opened as the catalog rows they are. */
export const PantryItemRecipesSection: React.FC<{ itemName: string }> = ({
  itemName,
}) => {
  const { t } = useTranslation();
  const { toRecipeDetail } = useAppNavigation();
  const { suggestedRecipes, loadingRecipes, recipesState, retryRecipes } =
    useRecipeSuggestionsForItem(itemName);

  return (
    <DetailSection title={t('labels.recipesToTry')}>
      {loadingRecipes ? (
        <ThemedActivityIndicator size="small" style={styles.loading} />
      ) : suggestedRecipes.length > 0 ? (
        <HorizontalRail surface="surface">
          {suggestedRecipes.map(recipe => (
            <AppPressable
              key={catalogKey(recipe)}
              style={styles.card}
              onPress={() => toRecipeDetail({ catalog: catalogHintOf(recipe) })}
            >
              <CachedImage
                uri={recipe.imageUrl}
                style={styles.image}
                sharedTransitionTag={`recipe-image-${recipe.providerRecipeId}`}
              />
              <Text role="label" style={styles.title} numberOfLines={2}>
                {recipe.name}
              </Text>
            </AppPressable>
          ))}
        </HorizontalRail>
      ) : recipesState === 'error' || recipesState === 'offline' ? (
        <DataStateView state={recipesState} onRetry={retryRecipes} />
      ) : (
        <Text role="caption" style={styles.none}>
          {t('pantryItemDetail.noRecipeSuggestions')}
        </Text>
      )}
    </DetailSection>
  );
};

const styles = StyleSheet.create(theme => ({
  loading: {
    marginTop: theme.spacing.sm,
  },
  card: {
    width: 140,
  },
  image: {
    width: 140,
    height: 100,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  title: {
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
  },
  none: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
}));
