import { useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { errorService } from '#/services/errorService';
import { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import { recipeCardBasics } from '#features/recipes/utils/recipeCardText';
import { DEFAULT_FILTERS } from '#features/recipes/utils/recipeFilterOptions';
import { rowKey, type FoundRow } from '#features/recipes/utils/recipeRows';
import { fetchTextPage } from './useRecipeSearch';
import { UseRecipeTextSearch_PickedRecipeFragmentDoc } from './useRecipeTextSearch.generated';
import { catalogHintOf, type RecipeTarget } from './useOpenCatalogRecipe';

const MIN_QUERY_LENGTH = 3;

export type PickerDietTag = 'vegan' | 'vegetarian' | 'glutenFree' | 'dairyFree';

/** A search result as a picker row shows it. */
export interface PickerRecipe {
  key: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  dietTags: PickerDietTag[];
  /** A held recipe is planned by id; a catalog one is opened through the API first. */
  target: RecipeTarget;
}

function dietTagsOf(
  diets: readonly Diet[],
  freeOf: readonly Intolerance[],
): PickerDietTag[] {
  const tags: PickerDietTag[] = [];
  if (diets.includes(Diet.Vegan)) tags.push('vegan');
  else if (diets.includes(Diet.Vegetarian)) tags.push('vegetarian');
  if (diets.includes(Diet.GlutenFree)) tags.push('glutenFree');
  if (freeOf.includes(Intolerance.Dairy)) tags.push('dairyFree');
  return tags;
}

function pickerRecipeOf(row: FoundRow, translate: Translate): PickerRecipe {
  const node = row.source === 'recipe' ? row.recipe : row.hit;
  return {
    ...recipeCardBasics(node, translate),
    key: rowKey(row),
    dietTags: dietTagsOf(node.diets, node.freeOf),
    target:
      row.source === 'recipe'
        ? { recipeId: row.recipe.id }
        : { catalog: catalogHintOf(row.hit) },
  };
}

/**
 * A first-page recipe search for pickers outside the Recipes tab: a query
 * shorter than three characters clears the results, and a newer query
 * supersedes the one in flight.
 */
export const useRecipeTextSearch = () => {
  const { t } = useTranslation();
  const client = useApolloClient();
  const generationRef = useRef(0);
  // Kept as the API returned them: the copy is written below, while rendering,
  // so the rows follow a language change.
  const [found, setFound] = useState<FoundRow[]>([]);
  const [searching, setSearching] = useState(false);

  const clear = () => {
    generationRef.current += 1;
    setFound([]);
    setSearching(false);
  };

  const search = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      clear();
      return;
    }
    generationRef.current += 1;
    const generation = generationRef.current;
    setSearching(true);
    void fetchTextPage(client, trimmed, DEFAULT_FILTERS, null).then(fetched => {
      if (generation !== generationRef.current) return;
      // A failed search leaves the results empty; the caller's own list still shows.
      if ('error' in fetched) {
        errorService.reportError(fetched.error, {
          operation: 'pickerRecipeSearch',
        });
      }
      setFound('page' in fetched ? fetched.page.rows : []);
      setSearching(false);
    });
  };

  /**
   * Where a picked result goes. A held recipe is written first, so the meal or
   * template planning it names it before the server answers; the results not
   * picked are never kept.
   */
  const pick = (result: PickerRecipe): RecipeTarget => {
    const row = found.find(candidate => rowKey(candidate) === result.key);
    if (row?.source === 'recipe') {
      const { id, name, imageUrl, servings, totalTimeMinutes } = row.recipe;
      client.cache.writeFragment({
        fragment: UseRecipeTextSearch_PickedRecipeFragmentDoc,
        fragmentName: 'useRecipeTextSearch_pickedRecipe',
        data: {
          __typename: 'Recipe',
          id,
          name,
          imageUrl,
          servings,
          totalTimeMinutes,
        },
      });
    }
    return result.target;
  };

  const results = found.map(row => pickerRecipeOf(row, t));

  return { results, searching, search, clear, pick };
};
