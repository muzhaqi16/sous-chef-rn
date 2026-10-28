import type { FieldPolicy, StoreObject, TypePolicies } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';
import {
  catalogFetchKey,
  recordCatalogFetch,
  type CatalogField,
} from '#features/recipes/store/catalogFetchTimes';

/**
 * A catalog page: one answered without the catalog never replaces a complete
 * one, so a refresh during an outage keeps the list. A complete one records
 * when it arrived, which decides when a read asks again.
 */
const catalogPage = (field: CatalogField): FieldPolicy<StoreObject> => ({
  merge(existing, incoming, { args, readField }) {
    if (readField<boolean>('catalogAvailable', incoming) !== false) {
      recordCatalogFetch(catalogFetchKey(field, args), Date.now());
      return incoming;
    }
    return existing !== undefined &&
      readField<boolean>('catalogAvailable', existing) === true
      ? existing
      : incoming;
  },
});

/**
 * A recipe merges field-wise; `recipes` keys on the whole `filters` input.
 * Ingredients are ONE list whatever arguments read them: a paged selection and
 * a local writer naming none hold the same rows.
 */
export const recipesTypePolicies: TypePolicies = {
  Recipe: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      ingredientsConnection: mergeConnectionByNodeId(false),
    },
  },
  Query: {
    fields: {
      recipe: readByIdFromCache('Recipe'),
      recipes: {
        ...mergeConnectionByNodeId(),
        keyArgs: ['filters'],
      },
      // A ranking for one day and home: a new answer replaces the last, never
      // merges, and one home's never answers for another's.
      recipeSuggestions: {
        keyArgs: ['today', 'homeId'],
        merge: (_existing: unknown, incoming: unknown) => incoming,
      },
      catalogRecipesByIngredients: catalogPage('catalogRecipesByIngredients'),
      randomCatalogRecipes: catalogPage('randomCatalogRecipes'),
    },
  },
};
