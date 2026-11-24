import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { HorizontalRail } from '#components/molecules/HorizontalRail';
import { SectionHeaderRow } from '#components/molecules/SectionHeaderRow';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import type { useRecipeDietaryAlerts } from '#features/recipes/hooks/useRecipeDietaryAlerts';
import type { RecipeDetailState } from '#features/recipes/screens/RecipeDetail/useRecipeDetail';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { IngredientTile } from './IngredientTile';

interface RecipeIngredientsSectionProps {
  ingredients: DisplayIngredient[];
  detail: RecipeDetailState;
  household: ReturnType<typeof useRecipeDietaryAlerts>;
  /** A flagged ingredient opens its sheet instead of going on the list. */
  onOpenFlagged: (ingredient: DisplayIngredient) => void;
}

export const RecipeIngredientsSection: React.FC<
  RecipeIngredientsSectionProps
> = ({ ingredients, detail, household, onOpenFlagged }) => {
  const { t } = useTranslation();
  const showPrices = useBudgetAndPricesEnabled();
  const {
    addingToList,
    listedIngredients,
    missingIngredients,
    handleAddAll,
    handleAddMissing,
    handleAddSingleIngredient,
  } = detail;

  const addLabel = (label: string) =>
    addingToList ? t('labels.adding') : label;

  return (
    <View style={styles.section}>
      <SectionHeaderRow
        title={t('itemPhotos.perspective.ingredient_list')}
        action={
          // Nothing left to buy: what the pantry lacks is on the list.
          missingIngredients?.size === 0
            ? undefined
            : // The pantry holds some of it: add only the rest.
            missingIngredients && missingIngredients.size < ingredients.length
            ? {
                label: addLabel(
                  t('recipes.addMissing', { count: missingIngredients.size }),
                ),
                onPress: handleAddMissing,
                disabled: addingToList,
              }
            : {
                label: addLabel(t('recipes.addAll')),
                onPress: handleAddAll,
                disabled: addingToList,
              }
        }
        style={styles.header}
      />
      <HorizontalRail surface="background" bleed="page">
        {ingredients.map((ingredient, index) => {
          const alerts = household.alertsFor(ingredient.id);
          return (
            <IngredientTile
              key={`${ingredient.id}-${index}`}
              ingredient={ingredient}
              isAdded={listedIngredients.has(ingredient.id)}
              isMissing={!!missingIngredients?.has(ingredient.id)}
              alerts={alerts}
              showPrice={showPrices}
              onPress={() =>
                alerts.length > 0
                  ? onOpenFlagged(ingredient)
                  : handleAddSingleIngredient(ingredient)
              }
              testID={recipesTestIDs.ingredientTile(index)}
            />
          );
        })}
      </HorizontalRail>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
}));
