import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Badge } from '#components/atoms/Badge';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { suggestionTier } from '#domain/recipeCoverage';
import { toDisplayItems } from '#features/recipes/screens/recipeDisplayItems';
import { RestrictionsNote } from '#features/recipes/ui/RestrictionsNote';
import type { RecipeIngredientLine } from '#features/recipes/utils/recipeShoppingRows';
import { useSelectedHomeId } from '#store/useAppStore';
import type { useRecipePayoff } from '#features/onboarding/hooks/useRecipePayoff';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

type RecipePayoffProps = Pick<
  ReturnType<typeof useRecipePayoff>,
  'rows' | 'popular' | 'showCheckLabel'
> & {
  /** Who the meals are for, which titles the popular picks. */
  cooksFor: number | null;
  /** Finishes onboarding and opens the recipe once the app shows. */
  onOpen: (recipeId: string) => void;
  /** Adds what the recipe lacks to the list; true once it landed or queued. */
  onAddMissing: (
    recipeId: string,
    missing: readonly RecipeIngredientLine[],
  ) => Promise<boolean>;
};

/**
 * Recipes for the pantry just stocked: ready ones, then those that use
 * something held with what is left to buy, or popular picks for the answers
 * given. A tap opens the recipe over Today.
 */
export const RecipePayoff = ({
  rows,
  popular,
  showCheckLabel,
  cooksFor,
  onOpen,
  onAddMissing,
}: RecipePayoffProps) => {
  const { t } = useTranslation();
  const homeId = useSelectedHomeId();
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  if (rows.length === 0) return null;

  const addMissing = async (
    recipeId: string,
    missing: readonly RecipeIngredientLine[],
  ) => {
    setAdding(recipeId);
    const landed = await onAddMissing(recipeId, missing);
    setAdding(null);
    if (landed) setAdded(current => new Set(current).add(recipeId));
  };
  // A recipe that uses what is held but is not ready offers what it lacks.
  const missingOf = rows.map(row =>
    suggestionTier({
      coverage: row.edge.coverage,
      missingIngredientCount: row.edge.missingIngredientCount,
      usedIngredientCount: row.edge.usedIngredients.length,
    }) === 'almost' && row.edge.missingIngredients.length > 0
      ? { recipeId: row.edge.node.id, lines: row.edge.missingIngredients }
      : null,
  );

  return (
    <View style={styles.section} testID={onboardingTestIDs.payoff}>
      <Text role="bodyStrong">
        {!popular
          ? t('recipes.basedOnPantry')
          : cooksFor !== null
          ? t('onBoarding.payoffPopularTitle', { count: cooksFor })
          : t('onBoarding.payoffPopularTitleNoCount')}
      </Text>
      <RestrictionsNote homeId={homeId} />
      {toDisplayItems(rows, t).map((recipe, index) => {
        const recipeId =
          'recipeId' in recipe.target ? recipe.target.recipeId : null;
        const missing = missingOf[index];
        const isAdded = !!missing && added.has(missing.recipeId);
        return (
          <RowCard key={recipe.id}>
            <AppPressable
              onPress={recipeId ? () => onOpen(recipeId) : undefined}
              accessibilityRole="button"
              style={[commonStyles.rowSurface, commonStyles.rowContent]}
              testID={onboardingTestIDs.payoffRecipe(recipe.id)}
            >
              <RowThumbnail uri={recipe.imageUrl} />
              <View style={styles.text}>
                <Text role={rowType.title}>{recipe.title}</Text>
                <Text role={rowType.subtitle} tone="secondary">
                  {recipe.subtitle}
                </Text>
                {recipe.badge ? (
                  <Badge variant="success" size="small">
                    {recipe.badge.text}
                  </Badge>
                ) : null}
              </View>
            </AppPressable>
            {missing ? (
              <View style={styles.rowAction}>
                <Button
                  title={
                    isAdded
                      ? t('labels.added')
                      : t('recipes.addMissing', {
                          count: missing.lines.length,
                        })
                  }
                  icon={isAdded ? 'checkmark' : 'cart-outline'}
                  variant="outline"
                  size="small"
                  loading={adding === missing.recipeId}
                  disabled={isAdded}
                  onPress={() => {
                    void addMissing(missing.recipeId, missing.lines);
                  }}
                  testID={onboardingTestIDs.payoffAddMissing(missing.recipeId)}
                />
              </View>
            ) : null}
          </RowCard>
        );
      })}
      {showCheckLabel ? (
        <Text role="caption" tone="secondary">
          {t('dietaryAlerts.checkLabel')}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  text: {
    flex: 1,
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  rowAction: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    alignItems: 'flex-start',
  },
}));
