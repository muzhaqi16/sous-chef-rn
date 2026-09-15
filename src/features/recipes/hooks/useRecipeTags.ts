import { useQuery } from '@apollo/client/react';
import { MySavedRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import { SAVED_RECIPES_PAGE_SIZE } from '#features/recipes/hooks/useSavedRecipes';

/**
 * Hook to extract unique tags from user's saved recipes
 * Returns a list of tags for autocomplete suggestions and filtering
 */
export function useRecipeTags() {
  const { data } = useQuery(MySavedRecipesDocument, {
    variables: { first: SAVED_RECIPES_PAGE_SIZE },
    fetchPolicy: 'cache-first',
  });

  const savedRecipes =
    data?.me?.savedRecipesConnection?.edges?.map(e => e.node) ?? [];

  // Only the pages loaded so far: the connection is shared with the saved list,
  // so a caller needing every tag pages that list to the end.
  let tags: string[] = [];
  if (savedRecipes.length > 0) {
    const tagSet = new Set<string>();
    savedRecipes.forEach(savedRecipe => {
      if (savedRecipe.tags && savedRecipe.tags.length > 0) {
        savedRecipe.tags.forEach(tag => {
          tagSet.add(tag);
        });
      }
    });

    // Return sorted array of unique tags
    tags = Array.from(tagSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }

  return { tags };
}
