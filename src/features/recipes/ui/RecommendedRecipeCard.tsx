import React from 'react';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { useTranslation } from '#/i18n';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { ItemCard } from '#components/organisms/ItemCard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { recipeCardBasics } from '#features/recipes/utils/recipeCardText';
import { coverageBadge } from './coverageBadge';
import { RecommendedRecipeCard_RecipeFragmentDoc } from './RecommendedRecipeCard.generated';

interface RecommendedRecipeCardProps {
  recipeId: string;
  /** The recipe as it is now; until it is read, the recommendation's name. */
  recipe:
    | FragmentType<typeof RecommendedRecipeCard_RecipeFragmentDoc>
    | undefined;
  /** What the recommendation named it. */
  name: string;
  /** Its coverage when it was recommended, 0–100. */
  matchPercentage: number;
}

/** A recipe a notification recommends, as the recipes tab lists it. */
export const RecommendedRecipeCard: React.FC<RecommendedRecipeCardProps> = ({
  recipeId,
  recipe,
  name,
  matchPercentage,
}) => {
  const { t } = useTranslation();
  const { toRecipeDetail } = useAppNavigation();
  const { data, complete } = useFragment({
    fragment: RecommendedRecipeCard_RecipeFragmentDoc,
    fragmentName: 'RecommendedRecipeCard_recipe',
    from: recipe ?? null,
  });

  const { title, subtitle, imageUrl } = complete
    ? recipeCardBasics(data, t)
    : { title: name, subtitle: '', imageUrl: undefined };

  return (
    <ItemCard
      id={recipeId}
      title={title}
      subtitle={subtitle}
      badge={coverageBadge(matchPercentage, t)}
      leftElement={imageUrl ? <RowThumbnail uri={imageUrl} /> : undefined}
      onPress={() => toRecipeDetail({ recipeId })}
    />
  );
};
