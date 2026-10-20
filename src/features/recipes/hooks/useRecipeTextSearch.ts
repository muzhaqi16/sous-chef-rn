import { useRef, useState } from 'react';
import type { ApolloClient } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import {
  SearchRecipesDocument,
  type SearchRecipesQuery,
} from './useRecipeSearch.generated';
import { catalogKey } from '#domain/catalogRecipes';
import { timeAndServings } from '#features/recipes/utils/recipeCardText';
import { catalogHintOf, type RecipeTarget } from './useOpenCatalogRecipe';

const MIN_QUERY_LENGTH = 3;
const PICKER_PAGE_SIZE = 25;

type FoundNode = SearchRecipesQuery['findRecipes']['edges'][number]['node'];

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

function pickerRecipeOf(node: FoundNode, translate: Translate): PickerRecipe {
  const shown = {
    title: node.name,
    subtitle: timeAndServings(
      node.totalTimeMinutes,
      node.servings,
      translate,
    ).join(' • '),
    imageUrl: node.imageUrl ?? undefined,
  };
  if (node.__typename === 'Recipe') {
    return {
      ...shown,
      key: `recipe-${node.id}`,
      dietTags: dietTagsOf(node.diets, node.freeOf),
      target: { recipeId: node.id },
    };
  }
  return {
    ...shown,
    key: catalogKey(node),
    dietTags: dietTagsOf(node.diets, node.freeOf),
    target: { catalog: catalogHintOf(node) },
  };
}

/** The first page of a search; empty after a failure. */
async function firstPage(
  client: ApolloClient,
  query: string,
): Promise<FoundNode[]> {
  try {
    const result = await client.query({
      query: SearchRecipesDocument,
      variables: { query, first: PICKER_PAGE_SIZE },
      // Nothing reads a search back from the cache, so it is never written.
      fetchPolicy: 'no-cache',
    });
    return result.data?.findRecipes.edges.map(edge => edge.node) ?? [];
  } catch {
    // A failed search leaves the results empty; the caller's own list still shows.
    return [];
  }
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
  const [found, setFound] = useState<FoundNode[]>([]);
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
    void firstPage(client, trimmed).then(nodes => {
      if (generation !== generationRef.current) return;
      setFound(nodes);
      setSearching(false);
    });
  };

  const results = found.map(node => pickerRecipeOf(node, t));

  return { results, searching, search, clear };
};
