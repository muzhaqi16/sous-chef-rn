import { skipToken, useQuery } from '@apollo/client/react';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useSelectedHomeId } from '#store/useAppStore';
import { RecipeMissingIngredientsDocument } from './useRecipeMissingIngredients.generated';

/**
 * The ids of a recipe's ingredients the selected home's pantries lack, as the
 * server matches them. Null until it has answered for this recipe and home:
 * a read the device does not hold is never "nothing missing".
 */
export function useRecipeMissingIngredients(
  recipeId: string | undefined,
): ReadonlySet<string> | null {
  const homeId = useSelectedHomeId() ?? undefined;
  const { data, variables, error } = useQuery(
    RecipeMissingIngredientsDocument,
    recipeId ? { variables: { id: recipeId, homeId } } : skipToken,
  );
  useApolloErrorLogger(RecipeMissingIngredientsDocument, error);

  // `skipToken` keeps the last run's data: it may be another recipe's.
  const answered =
    recipeId !== undefined &&
    variables.id === recipeId &&
    variables.homeId === homeId;
  const edges = answered
    ? data?.recipe?.missingIngredientsConnection.edges
    : undefined;
  return edges ? new Set(edges.map(edge => edge.node.id)) : null;
}
