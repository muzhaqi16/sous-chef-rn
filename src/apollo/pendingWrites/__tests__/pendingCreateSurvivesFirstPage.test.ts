/**
 * A first page is authoritative, and a row created offline is not on it. The
 * root takes the page as the server sent it; the row's layer, rebuilt over it,
 * keeps showing the row until its write is answered or refused.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { seedQuery } from '#/test-utils/apolloMockProvider';
import {
  AddRecipeToFavoritesDocument,
  ForkRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  addFavorite,
  createRecipe,
  type AddFavoriteInputs,
  type CreateRecipeInputs,
} from '#features/recipes/offline/localWrites';
import { PendingWrites } from '../pendingWrites';

const NOW = '2026-10-30T10:00:00.000Z';

const RECIPES = gql`
  query PendingCreateRecipes {
    recipes(first: 25) {
      totalCount
      edges {
        node {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const SAVED = gql`
  query PendingCreateSaved {
    me {
      id
      savedRecipesConnection(first: 20) {
        totalCount
        edges {
          node {
            id
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const FAVORITES_VIEWER = gql`
  query PendingCreateViewer {
    me {
      id
    }
  }
`;

type Recipes = { recipes: { edges: { node: { id: string } }[] } };
type Saved = {
  me: { savedRecipesConnection: { edges: { node: { id: string } }[] } };
};

const recipePage = (ids: string[]) => ({
  recipes: {
    __typename: 'RecipeConnection',
    totalCount: ids.length,
    edges: ids.map(id => ({
      __typename: 'RecipeEdge',
      node: { __typename: 'Recipe', id },
    })),
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
  },
});

const savedPage = (ids: string[]) => ({
  me: {
    __typename: 'User',
    id: 'user-1',
    savedRecipesConnection: {
      __typename: 'SavedRecipeConnection',
      totalCount: ids.length,
      edges: ids.map(id => ({
        __typename: 'SavedRecipeEdge',
        node: { __typename: 'SavedRecipe', id, recipeId: `recipe-of-${id}` },
      })),
      pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
    },
  },
});

function setup() {
  const cache = makeCache();
  seedQuery(cache, { query: RECIPES, data: recipePage(['source-1']) });
  seedQuery(cache, { query: SAVED, data: savedPage(['saved-1']) });
  seedQuery(cache, {
    query: FAVORITES_VIEWER,
    data: { me: { __typename: 'User', id: 'user-1' } },
  });
  const table = {
    ForkRecipe: createRecipe,
    AddRecipeToFavorites: addFavorite,
  };
  return { cache, writes: new PendingWrites(cache, table) };
}

type Setup = ReturnType<typeof setup>;

const recipes = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery<Recipes>({ query: RECIPES, optimistic })
    ?.recipes.edges.map(({ node }) => node.id);

const saved = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery<Saved>({ query: SAVED, optimistic })
    ?.me.savedRecipesConnection.edges.map(({ node }) => node.id);

const fork = ({ writes }: Setup) => {
  const inputs: CreateRecipeInputs = {
    id: 'fork-1',
    recipe: { name: 'Copy', instructions: [], ingredients: [] },
    createdBy: null,
    ingredientIds: [],
  };
  return writes.begin(
    ForkRecipeDocument,
    { input: { id: 'source-1', newRecipeId: 'fork-1' } },
    inputs,
  );
};

const favourite = ({ writes }: Setup) => {
  const inputs: AddFavoriteInputs = {
    savedRecipeId: 'saved-offline',
    recipeId: 'recipe-1',
    options: {},
    now: NOW,
  };
  return writes.begin(
    AddRecipeToFavoritesDocument,
    { input: { id: 'saved-offline', recipeId: 'recipe-1' } },
    inputs,
  );
};

describe('a create the server has not taken, and a first page', () => {
  it('keeps a fork in the recipe list, leaving the page as the server sent it', () => {
    const screen = setup();
    fork(screen);

    seedQuery(screen.cache, {
      query: RECIPES,
      data: recipePage(['source-2', 'source-1']),
    });
    screen.writes.rebuild();

    expect(recipes(screen)).toEqual(
      expect.arrayContaining(['fork-1', 'source-2', 'source-1']),
    );
    expect(recipes(screen, false)).toEqual(['source-2', 'source-1']);
  });

  it('keeps a favourite in the saved list, leaving the page as the server sent it', () => {
    const screen = setup();
    favourite(screen);

    seedQuery(screen.cache, { query: SAVED, data: savedPage(['saved-1']) });
    screen.writes.rebuild();

    expect(saved(screen)).toEqual(
      expect.arrayContaining(['saved-1', 'saved-offline']),
    );
    expect(saved(screen, false)).toEqual(['saved-1']);
  });

  it('shows the page alone once the write is refused', () => {
    const screen = setup();
    const write = favourite(screen);

    seedQuery(screen.cache, { query: SAVED, data: savedPage(['saved-1']) });
    screen.writes.drop(write.id);

    expect(saved(screen)).toEqual(['saved-1']);
  });
});
