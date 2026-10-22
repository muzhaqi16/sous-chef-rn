import React from 'react';
import { useTranslation } from '#/i18n';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { ItemCard } from '#components/organisms/ItemCard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { recipeCardBasics } from '#features/recipes/utils/recipeCardText';
import { coverageBadge } from '#features/recipes/screens/recipeDisplayItems';
import { useRecommendedRecipe } from './useRecommendedRecipe';

interface RecommendedRecipeCardProps {
  recipeId: string;
  /** What the recommendation named it, shown until the recipe is read. */
  name: string;
  /** Its coverage when recommended, shown until the current one is read. */
  matchPercentage: number | null;
  testID?: string;
}

/** A recipe a notification recommends, as the recipes tab lists it. */
export const RecommendedRecipeCard: React.FC<RecommendedRecipeCardProps> = ({
  recipeId,
  name,
  matchPercentage,
  testID,
}) => {
  const { t } = useTranslation();
  const { toRecipeDetail } = useAppNavigation();
  const recipe = useRecommendedRecipe(recipeId);
  if (recipe === null) return null;

  const { title, subtitle, imageUrl } = recipe
    ? recipeCardBasics(recipe, t)
    : { title: name, subtitle: '', imageUrl: undefined };
  const coverage = recipe?.matchPercentage ?? matchPercentage;

  return (
    <ItemCard
      id={recipeId}
      title={title}
      subtitle={subtitle}
      badge={
        coverage === null ? undefined : coverageBadge(Math.round(coverage), t)
      }
      leftElement={imageUrl ? <RowThumbnail uri={imageUrl} /> : undefined}
      onPress={() => toRecipeDetail({ recipeId })}
      testID={testID}
    />
  );
};
