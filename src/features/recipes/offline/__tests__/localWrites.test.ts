import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import type { PendingWrite } from '#/apollo/pendingWrites/types';
import {
  completeSeed,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import {
  AddRecipeToFavoritesDocument,
  CreateRecipeDocument,
  DeleteRecipeFolderDocument,
  RemoveRecipeFromFavoritesDocument,
  SavedRecipeFoldersDocument,
  UpdateFavoriteRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/screens/useSavedRecipes.generated';
import {
  addFavorite,
  createRecipe,
  moveFolder,
  removeFavorite,
  savedFields,
  type AddFavoriteInputs,
  type CreateRecipeInputs,
  type MoveFolderInputs,
  type RemoveFavoriteInputs,
  type SavedFieldsInputs,
} from '../localWrites';

const NOW = '2026-10-30T10:00:00.000Z';
const MINTED_ID = 'minted-saved-1';
const SERVER_ID = 'server-saved-1';
const RECIPE_ID = 'recipe-1';

const SAVED_DETAILS = gql`
  fragment LocalWritesSavedDetails on Recipe {
    id
    savedDetails {
      id
    }
  }
`;

const SAVED_FOLDER = gql`
  fragment LocalWritesSavedFolder on SavedRecipe {
    id
    recipeId
    folder
  }
`;

const RECIPE_INGREDIENTS = gql`
  fragment LocalWritesIngredients on Recipe {
    id
    ingredientsConnection {
      edges {
        node {
          id
        }
      }
    }
  }
`;

function setup(saved: string[] = []) {
  const cache = makeCache();
  seedQuery<MySavedRecipesQuery>(cache, {
    query: MySavedRecipesDocument,
    data: {
      __typename: 'Query',
      me: {
        __typename: 'User',
        id: 'user-1',
        savedRecipesConnection: {
          __typename: 'SavedRecipeConnection',
          totalCount: saved.length,
          edges: saved.map(id => ({
            __typename: 'SavedRecipeEdge',
            node: { __typename: 'SavedRecipe', id, recipeId: RECIPE_ID },
          })),
          pageInfo: { __typename: 'PageInfo' },
        },
      },
    },
  });
  seedQuery(cache, {
    query: SavedRecipeFoldersDocument,
    data: { __typename: 'Query', savedRecipeFolders: ['Dinner', 'Lunch'] },
  });
  seedFragment(cache, {
    fragment: SAVED_DETAILS,
    data: {
      __typename: 'Recipe',
      id: RECIPE_ID,
      savedDetails: saved[0]
        ? { __typename: 'SavedRecipe', id: saved[0] }
        : null,
    },
  });
  const table = {
    CreateRecipe: createRecipe,
    AddRecipeToFavorites: addFavorite,
    RemoveRecipeFromFavorites: removeFavorite,
    UpdateFavoriteRecipe: savedFields,
    DeleteRecipeFolder: moveFolder,
  };
  return { cache, writes: new PendingWrites(cache, table) };
}

type Setup = ReturnType<typeof setup>;

const savedList = ({ cache }: Setup, optimistic = true) => {
  const connection = cache.readQuery({
    query: MySavedRecipesDocument,
    optimistic,
  })?.me?.savedRecipesConnection;
  return {
    ids: connection?.edges.map(edge => edge.node.id),
    totalCount: connection?.totalCount,
  };
};

const heart = ({ cache }: Setup, optimistic = true) =>
  cache.readFragment<{ savedDetails: { id: string } | null }>({
    id: cache.identify({ __typename: 'Recipe', id: RECIPE_ID }),
    fragment: SAVED_DETAILS,
    optimistic,
  })?.savedDetails?.id;

const folders = ({ cache }: Setup, optimistic = true) =>
  cache.readQuery({ query: SavedRecipeFoldersDocument, optimistic })
    ?.savedRecipeFolders;

const folderOf = (cache: InMemoryCache, id: string, optimistic = true) =>
  cache.readFragment<{ folder: string | null }>({
    id: cache.identify({ __typename: 'SavedRecipe', id }),
    fragment: SAVED_FOLDER,
    optimistic,
  })?.folder;

const seedSavedRow = (cache: InMemoryCache, id: string, folder: string) =>
  seedFragment(cache, {
    fragment: SAVED_FOLDER,
    data: { __typename: 'SavedRecipe', id, recipeId: RECIPE_ID, folder },
  });

/** The server answers: Apollo writes it to the root, then the write commits. */
function answered(
  { cache, writes }: Setup,
  { id, document, variables }: PendingWrite,
  data: Record<string, unknown>,
): void {
  const stated = completeSeed(document, variables, data);
  seedQuery(cache, {
    id: 'ROOT_MUTATION',
    query: document,
    variables,
    data: stated,
  });
  writes.confirm(id, stated);
  writes.rebuild();
}

const save = ({ writes }: Setup) => {
  const inputs: AddFavoriteInputs = {
    savedRecipeId: MINTED_ID,
    recipeId: RECIPE_ID,
    options: { folder: 'Dinner' },
    now: NOW,
  };
  return writes.begin(
    AddRecipeToFavoritesDocument,
    { input: { id: MINTED_ID, recipeId: RECIPE_ID, folder: 'Dinner' } },
    inputs,
  );
};

const savedAs = (id: string, folder = 'Dinner') => ({
  addRecipeToFavorites: {
    __typename: 'AddRecipeToFavoritesPayload',
    savedRecipe: {
      __typename: 'SavedRecipe',
      id,
      recipeId: RECIPE_ID,
      folder,
    },
    recipe: {
      __typename: 'Recipe',
      id: RECIPE_ID,
      savedDetails: { __typename: 'SavedRecipe', id },
    },
  },
});

const unsave = ({ writes }: Setup) => {
  const inputs: RemoveFavoriteInputs = { recipeId: RECIPE_ID };
  return writes.begin(
    RemoveRecipeFromFavoritesDocument,
    { input: { recipeId: RECIPE_ID } },
    inputs,
  );
};

const moveTo = (
  { writes }: Setup,
  folder: string,
  destination: string | null,
) => {
  const inputs: MoveFolderInputs = { folder, moveTo: destination };
  return writes.begin(
    DeleteRecipeFolderDocument,
    { input: { folder, moveTo: destination } },
    inputs,
  );
};

describe('creating a recipe', () => {
  const create = ({ writes }: Setup) => {
    const inputs: CreateRecipeInputs = {
      id: 'recipe-new',
      recipe: {
        name: 'Soup',
        instructions: [],
        ingredients: [{ name: 'Salt' }, { name: 'Water' }],
      },
      createdBy: null,
      ingredientIds: ['ingredient-1', 'ingredient-2'],
    };
    return writes.begin(
      CreateRecipeDocument,
      { input: { id: 'recipe-new' } },
      inputs,
    );
  };

  const ingredientIds = ({ cache }: Setup) =>
    cache
      .readFragment<{
        ingredientsConnection: { edges: { node: { id: string } }[] };
      }>({
        id: 'Recipe:recipe-new',
        fragment: RECIPE_INGREDIENTS,
        optimistic: true,
      })
      ?.ingredientsConnection.edges.map(edge => edge.node.id);

  it('keeps the ingredient ids it was made with, however often it is rebuilt', () => {
    const screen = setup();

    create(screen);
    screen.writes.rebuild();
    screen.writes.rebuild();

    expect(ingredientIds(screen)).toEqual(['ingredient-1', 'ingredient-2']);
  });

  it('leaves nothing when refused', () => {
    const screen = setup();

    screen.writes.drop(create(screen).id);

    expect(screen.cache.extract(true)['Recipe:recipe-new']).toBeUndefined();
  });
});

describe('saving a recipe', () => {
  it('fills the heart and lists the row, leaving the server data as it was', () => {
    const screen = setup();

    save(screen);
    screen.writes.rebuild();

    expect(savedList(screen)).toEqual({ ids: [MINTED_ID], totalCount: 1 });
    expect(heart(screen)).toBe(MINTED_ID);
    expect(savedList(screen, false)).toEqual({ ids: [], totalCount: 0 });
    expect(heart(screen, false)).toBeUndefined();
  });

  it('ends on the server data when refused', () => {
    const screen = setup();

    screen.writes.drop(save(screen).id);

    expect(savedList(screen)).toEqual({ ids: [], totalCount: 0 });
    expect(heart(screen)).toBeUndefined();
    expect(
      screen.cache.extract(true)[`SavedRecipe:${MINTED_ID}`],
    ).toBeUndefined();
  });

  it('lists the row under its minted id once answered', () => {
    const screen = setup();

    answered(screen, save(screen), savedAs(MINTED_ID));

    expect(savedList(screen, false)).toEqual({
      ids: [MINTED_ID],
      totalCount: 1,
    });
    expect(heart(screen, false)).toBe(MINTED_ID);
  });

  it('moves a save the server converged on an existing row onto that row', () => {
    const screen = setup();

    answered(screen, save(screen), savedAs(SERVER_ID));

    expect(savedList(screen, false)).toEqual({
      ids: [SERVER_ID],
      totalCount: 1,
    });
    expect(heart(screen, false)).toBe(SERVER_ID);
    expect(screen.cache.extract()[`SavedRecipe:${MINTED_ID}`]).toBeUndefined();
  });

  it('offers a folder the list did not hold', () => {
    const screen = setup();

    answered(screen, save(screen), savedAs(MINTED_ID, 'Soups'));

    expect(folders(screen, false)).toEqual(['Dinner', 'Lunch', 'Soups']);
  });
});

describe('un-saving a recipe', () => {
  it('empties the heart and the list, leaving the server data as it was', () => {
    const screen = setup([SERVER_ID]);

    unsave(screen);
    screen.writes.rebuild();

    expect(savedList(screen)).toEqual({ ids: [], totalCount: 0 });
    expect(heart(screen)).toBeUndefined();
    expect(savedList(screen, false)).toEqual({
      ids: [SERVER_ID],
      totalCount: 1,
    });
  });

  it('counts the removal once, however often it is rebuilt', () => {
    const screen = setup([SERVER_ID]);

    unsave(screen);
    screen.writes.rebuild();
    screen.writes.rebuild();

    expect(savedList(screen).totalCount).toBe(0);
  });

  it('shows the recipe saved again when refused', () => {
    const screen = setup([SERVER_ID]);

    screen.writes.drop(unsave(screen).id);

    expect(savedList(screen)).toEqual({ ids: [SERVER_ID], totalCount: 1 });
    expect(heart(screen)).toBe(SERVER_ID);
  });

  it('leaves the list once answered, which the answer does not state', () => {
    const screen = setup([SERVER_ID]);

    answered(screen, unsave(screen), {
      removeRecipeFromFavorites: {
        __typename: 'RemoveRecipeFromFavoritesPayload',
        savedRecipe: { __typename: 'SavedRecipe', id: SERVER_ID },
        recipe: { __typename: 'Recipe', id: RECIPE_ID, savedDetails: null },
      },
    });

    expect(savedList(screen, false)).toEqual({ ids: [], totalCount: 0 });
    expect(heart(screen, false)).toBeUndefined();
  });
});

describe('editing a saved row', () => {
  const edit = ({ writes }: Setup, inputs: SavedFieldsInputs) =>
    writes.begin(
      UpdateFavoriteRecipeDocument,
      { input: { recipeId: RECIPE_ID, folder: 'Soups' } },
      inputs,
    );

  it('shows the edit, and ends on the server data when refused', () => {
    const screen = setup([SERVER_ID]);
    seedSavedRow(screen.cache, SERVER_ID, 'Dinner');

    const write = edit(screen, {
      savedRecipeId: SERVER_ID,
      fields: { folder: 'Soups' },
    });
    screen.writes.rebuild();
    expect(folderOf(screen.cache, SERVER_ID)).toBe('Soups');

    screen.writes.drop(write.id);
    expect(folderOf(screen.cache, SERVER_ID)).toBe('Dinner');
  });

  it('offers the folder its answer states', () => {
    const screen = setup([SERVER_ID]);
    seedSavedRow(screen.cache, SERVER_ID, 'Dinner');

    answered(
      screen,
      edit(screen, { savedRecipeId: SERVER_ID, fields: { folder: 'Soups' } }),
      {
        updateFavoriteRecipe: {
          __typename: 'UpdateFavoriteRecipePayload',
          savedRecipe: {
            __typename: 'SavedRecipe',
            id: SERVER_ID,
            recipeId: RECIPE_ID,
            folder: 'Soups',
          },
          recipe: { __typename: 'Recipe', id: RECIPE_ID },
        },
      },
    );

    expect(folders(screen, false)).toEqual(['Dinner', 'Lunch', 'Soups']);
  });
});

describe('moving a folder', () => {
  it('renames it and carries its recipes, leaving the server data as it was', () => {
    const screen = setup([SERVER_ID]);
    seedSavedRow(screen.cache, SERVER_ID, 'Dinner');
    seedSavedRow(screen.cache, 'other-saved', 'Lunch');

    moveTo(screen, 'Dinner', 'Suppers');
    screen.writes.rebuild();

    expect(folders(screen)).toEqual(['Suppers', 'Lunch']);
    expect(folderOf(screen.cache, SERVER_ID)).toBe('Suppers');
    expect(folderOf(screen.cache, 'other-saved')).toBe('Lunch');
    expect(folders(screen, false)).toEqual(['Dinner', 'Lunch']);
    expect(folderOf(screen.cache, SERVER_ID, false)).toBe('Dinner');
  });

  it('unfolders its recipes when deleted', () => {
    const screen = setup([SERVER_ID]);
    seedSavedRow(screen.cache, SERVER_ID, 'Dinner');

    moveTo(screen, 'Dinner', null);
    screen.writes.rebuild();

    expect(folders(screen)).toEqual(['Lunch']);
    expect(folderOf(screen.cache, SERVER_ID)).toBeNull();
  });

  it('ends on the server data when refused', () => {
    const screen = setup([SERVER_ID]);
    seedSavedRow(screen.cache, SERVER_ID, 'Dinner');

    screen.writes.drop(moveTo(screen, 'Dinner', 'Suppers').id);

    expect(folders(screen)).toEqual(['Dinner', 'Lunch']);
    expect(folderOf(screen.cache, SERVER_ID)).toBe('Dinner');
  });

  it('keeps the move once answered, as the answer states only a name', () => {
    const screen = setup([SERVER_ID]);
    seedSavedRow(screen.cache, SERVER_ID, 'Dinner');

    answered(screen, moveTo(screen, 'Dinner', 'Suppers'), {
      deleteRecipeFolder: {
        __typename: 'DeleteRecipeFolderPayload',
        folder: 'Dinner',
        movedCount: 1,
      },
    });

    expect(folders(screen, false)).toEqual(['Suppers', 'Lunch']);
    expect(folderOf(screen.cache, SERVER_ID, false)).toBe('Suppers');
  });
});
