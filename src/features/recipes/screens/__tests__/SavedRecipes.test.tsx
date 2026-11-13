import React from 'react';
import { act, screen, userEvent, within } from '@testing-library/react-native';
import { FlashList } from '@shopify/flash-list';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { screenShows } from '#/test-utils/cacheWaits';
import type { ApolloClient } from '@apollo/client';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t } from '#/i18n';
import {
  RemoveRecipeFromFavoritesDocument,
  SavedRecipeFoldersDocument,
} from '#features/recipes/graphql/recipe.generated';
import { MySavedRecipesDocument } from '#features/recipes/screens/useSavedRecipes.generated';
import { SAVED_RECIPES_PAGE_SIZE } from '#features/recipes/screens/useSavedRecipes';
import { FolderPicker } from '#features/recipes/components/FolderPicker';
import { TagPicker } from '#features/recipes/components/TagPicker';
import { kitTestIDs } from '#components/testIDs';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { SavedRecipes } from '../SavedRecipes';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

let log = operationLog();

interface Saved {
  id: string;
  name: string;
  folder?: string | null;
  tags?: string[];
  description?: string | null;
}

const APPLE: Saved = {
  id: 'sr-apple',
  name: 'Apple pie',
  folder: 'Weeknights',
  tags: ['Quick'],
  description: 'A crumble top',
};
const BANANA: Saved = {
  id: 'sr-banana',
  name: 'Banana bread',
  tags: ['Vegan'],
};
const CARROT: Saved = {
  id: 'sr-carrot',
  name: 'Carrot cake',
  folder: 'Weeknights',
  tags: ['Party'],
};

/** One page of the saved list; `next` names the page after it. */
const savedPage = (
  rows: Saved[],
  next: string | null,
): MockDataFor<typeof MySavedRecipesDocument> => ({
  me: {
    __typename: 'User',
    id: 'user-1',
    savedRecipesConnection: {
      __typename: 'SavedRecipeConnection',
      edges: rows.map(
        ({ id, name, folder = null, tags = [], description }) => ({
          __typename: 'SavedRecipeEdge',
          cursor: id,
          node: {
            __typename: 'SavedRecipe',
            id,
            recipeId: `recipe-${id}`,
            folder,
            tags,
            notes: null,
            personalRating: null,
            cookedCount: 0,
            lastCookedAt: null,
            recipe: {
              __typename: 'Recipe',
              version: 1,
              id: `recipe-${id}`,
              name,
              description: description ?? null,
              imageUrl: null,
            },
          },
        }),
      ),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: next !== null,
        endCursor: next,
      },
      totalCount: rows.length,
    },
  },
});

/** The page read after `after` (the first when undefined). */
const page = (
  after: string | undefined,
  rows: Saved[],
  next: string | null,
  options: { held?: boolean; maxUsageCount?: number } = {},
) =>
  recordMock(MySavedRecipesDocument, {
    match: variables => variables.after === after,
    data: savedPage(rows, next),
    ...options,
  });

const failingPage = (after: string, maxUsageCount?: number) =>
  recordMock(MySavedRecipesDocument, {
    match: variables => variables.after === after,
    error: new Error('Network request failed'),
    maxUsageCount,
  });

function openSaved({
  answers = [],
  folders = [],
}: {
  answers?: ReturnType<typeof recordMock>[];
  folders?: string[];
} = {}) {
  const folderRead = recordMock(SavedRecipeFoldersDocument, {
    data: { savedRecipeFolders: folders },
  });
  const { client } = renderWithApollo(<SavedRecipes />, {
    links: [log.link],
    operationMocks: [...answers.map(answer => answer.mock), folderRead.mock],
  });
  return { client };
}

const FIRST_PAGE = {
  query: MySavedRecipesDocument,
  variables: { first: SAVED_RECIPES_PAGE_SIZE },
};

/** Waits until the list holds `rows` recipes, which a later page adds a task after it lands. */
const listHolds = (client: ApolloClient, rows: number) =>
  act(async () => {
    await screenShows(
      client,
      FIRST_PAGE,
      () =>
        client.readQuery(FIRST_PAGE)?.me?.savedRecipesConnection.edges.length,
      seen => seen === rows,
    );
  });

/** The saved list, the one list with a pull to refresh (the pickers' have none). */
const savedList = () => {
  const list = screen
    .UNSAFE_getAllByType(FlashList)
    .find(candidate => candidate.props.refreshControl);
  if (!list) throw new Error('no saved list on screen');
  return list;
};

/** Two pages: Apple pie and Banana bread, then Carrot cake. */
const twoPages = () => [
  page(undefined, [APPLE, BANANA], 'page-1'),
  page('page-1', [CARROT], null),
];

const tab = (id: string) =>
  screen.getByTestId(
    kitTestIDs.filterTab(recipesTestIDs.savedRecipesFilterTabPrefix, id),
  );

const search = async (term: string) => {
  const user = userEvent.setup();
  const field = screen.getByPlaceholderText(
    t('recipes.savedRecipesSearchPlaceholder'),
  );
  await user.clear(field);
  await user.type(field, term);
};

/** The recipes the list shows, by name. */
const shown = () =>
  [APPLE, BANANA, CARROT]
    .map(saved => saved.name)
    .filter(name => screen.queryByLabelText(name) !== null);

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  resetSessionScopedStores();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    isOnline: true,
    apiReachable: true,
  });
});

describe('the saved list', () => {
  it('shows each saved recipe, and opens one', async () => {
    openSaved({ answers: [page(undefined, [APPLE, BANANA], null)] });
    await log.landed(MySavedRecipesDocument);

    expect(shown()).toEqual(['Apple pie', 'Banana bread']);
    await userEvent.setup().press(screen.getByLabelText('Apple pie'));

    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith({
      recipeId: 'recipe-sr-apple',
    });
  });

  it('removes one from saved', async () => {
    const removed = recordMock(RemoveRecipeFromFavoritesDocument, {
      held: true,
    });
    openSaved({
      answers: [page(undefined, [APPLE], null), removed],
    });
    await log.landed(MySavedRecipesDocument);

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('recipes.removeFromSavedA11y')));
    await log.requested(RemoveRecipeFromFavoritesDocument);

    expect(inputOf(removed.fired[0] ?? {})).toMatchObject({
      recipeId: 'recipe-sr-apple',
    });
  });

  it('says none are saved when none are', async () => {
    openSaved({ answers: [page(undefined, [], null)] });
    await log.landed(MySavedRecipesDocument);

    expect(screen.getByText(t('recipes.savedRecipesEmptyTitle'))).toBeTruthy();
  });

  it('reads nothing signed out, and says none are saved', async () => {
    useStore.setState({ user: null });
    openSaved();

    expect(screen.getByText(t('recipes.savedRecipesEmptyTitle'))).toBeTruthy();
    expect(screen.queryByText(t('dataState.errorTitle'))).not.toBeOnTheScreen();
  });

  it('reads the next page at its end', async () => {
    const { client } = openSaved({ answers: twoPages() });
    await log.landed(MySavedRecipesDocument);

    act(() => {
      savedList().props.onEndReached();
    });
    await listHolds(client, 3);

    expect(shown()).toEqual(['Apple pie', 'Banana bread', 'Carrot cake']);
  });

  it('reads the folders again on a pull', async () => {
    openSaved({
      answers: [page(undefined, [APPLE], null)],
      folders: ['Weeknights'],
    });
    await log.landed(MySavedRecipesDocument);
    await log.landed(SavedRecipeFoldersDocument);

    act(() => {
      savedList().props.refreshControl.props.onRefresh();
    });

    await log.landed(SavedRecipeFoldersDocument, 2);
  });
});

describe('a search', () => {
  it('reads every page, and finds a recipe by its description', async () => {
    const { client } = openSaved({ answers: twoPages() });
    await log.landed(MySavedRecipesDocument);

    await search('carrot');
    await listHolds(client, 3);
    expect(shown()).toEqual(['Carrot cake']);

    await search('crumble');
    expect(shown()).toEqual(['Apple pie']);
  });

  it('names what it looked for when nothing matches', async () => {
    openSaved({ answers: [page(undefined, [APPLE, BANANA], null)] });
    await log.landed(MySavedRecipesDocument);

    await search('lasagna');

    expect(
      screen.getByText(t('empty.noResultsFor', { query: 'lasagna' })),
    ).toBeTruthy();
  });

  it('says it is still reading the rest while none have matched yet', async () => {
    openSaved({
      answers: [
        page(undefined, [APPLE, BANANA], 'page-1'),
        page('page-1', [CARROT], null, { held: true }),
      ],
    });
    await log.landed(MySavedRecipesDocument);

    await search('carrot');
    await log.requested(MySavedRecipesDocument, 2);

    expect(
      screen.getByText(t('recipes.savedRecipesSearchingAll')),
    ).toBeTruthy();
  });

  describe('over a page that cannot be read', () => {
    const withFailingPage = () =>
      openSaved({
        answers: [
          page(undefined, [APPLE, BANANA], 'page-1'),
          failingPage('page-1'),
        ],
      });

    it('says the results may be incomplete, and reads the rest again on a retry', async () => {
      withFailingPage();
      await log.landed(MySavedRecipesDocument);

      await search('carrot');
      await log.landed(MySavedRecipesDocument, 2);
      expect(screen.getByText(t('recipes.searchIncompleteTitle'))).toBeTruthy();
      expect(
        screen.queryByText(t('empty.noResultsFor', { query: 'carrot' })),
      ).not.toBeOnTheScreen();

      await userEvent.setup().press(screen.getByText(t('labels.retry')));

      await log.landed(MySavedRecipesDocument, 3);
    });

    it('flags the matches it shows, with a retry', async () => {
      withFailingPage();
      await log.landed(MySavedRecipesDocument);

      await search('apple');
      await log.landed(MySavedRecipesDocument, 2);
      expect(shown()).toEqual(['Apple pie']);
      expect(
        screen.getByTestId(recipesTestIDs.searchIncompleteNotice),
      ).toBeTruthy();

      await userEvent
        .setup()
        .press(screen.getByTestId(recipesTestIDs.searchIncompleteRetry));

      await log.landed(MySavedRecipesDocument, 3);
    });

    it('reads the rest again for a new search', async () => {
      withFailingPage();
      await log.landed(MySavedRecipesDocument);
      await search('carrot');
      await log.landed(MySavedRecipesDocument, 2);

      // Refined, never emptied: the search stays on throughout.
      await userEvent
        .setup()
        .type(
          screen.getByPlaceholderText(
            t('recipes.savedRecipesSearchPlaceholder'),
          ),
          ' cake',
        );

      await log.landed(MySavedRecipesDocument, 3);
    });
  });
});

describe('the folder filter', () => {
  it('shows the picked folder from every page, names it, and clears with All', async () => {
    const { client } = openSaved({
      answers: twoPages(),
      folders: ['Weeknights'],
    });
    await log.landed(MySavedRecipesDocument);
    await log.landed(SavedRecipeFoldersDocument);
    const user = userEvent.setup();
    const clear = () =>
      screen.getByTestId(recipesTestIDs.savedRecipesClearFilters);
    expect(clear().props.accessibilityState).toEqual({ disabled: true });

    await user.press(tab('folder'));
    await user.press(
      within(screen.UNSAFE_getByType(FolderPicker)).getByText('Weeknights'),
    );
    await listHolds(client, 3);

    expect(shown()).toEqual(['Apple pie', 'Carrot cake']);
    expect(within(tab('folder')).getByText('Weeknights')).toBeTruthy();
    expect(clear().props.accessibilityState).toEqual({ disabled: false });

    await user.press(tab('all'));
    expect(shown()).toEqual(['Apple pie', 'Banana bread', 'Carrot cake']);
  });

  it('is offered when the folders cannot be read', async () => {
    openSaved({
      answers: [
        page(undefined, [APPLE], null),
        recordMock(SavedRecipeFoldersDocument, {
          error: new Error('Network request failed'),
        }),
      ],
    });
    await log.landed(SavedRecipeFoldersDocument);

    expect(tab('folder')).toBeTruthy();
  });

  it('clears the search with the rest', async () => {
    openSaved({
      answers: [page(undefined, [APPLE, BANANA], null)],
      folders: ['Weeknights'],
    });
    await log.landed(MySavedRecipesDocument);
    await log.landed(SavedRecipeFoldersDocument);
    const user = userEvent.setup();
    await search('pie');
    await user.press(tab('folder'));
    await user.press(
      within(screen.UNSAFE_getByType(FolderPicker)).getByText('Weeknights'),
    );

    await user.press(
      screen.getByTestId(recipesTestIDs.savedRecipesClearFilters),
    );

    expect(
      screen.getByPlaceholderText(t('recipes.savedRecipesSearchPlaceholder'))
        .props.value,
    ).toBe('');
    expect(shown()).toEqual(['Apple pie', 'Banana bread']);
  });
});

describe('the tag filter', () => {
  it('is offered, uncounted, while a later page may hold the only tags', async () => {
    openSaved({
      answers: [
        page(undefined, [{ id: 'sr-plain', name: 'Plain rice' }], 'page-1'),
        page('page-1', [BANANA], null, { held: true }),
      ],
    });
    await log.landed(MySavedRecipesDocument);

    expect(within(tab('tags')).queryByText('0')).not.toBeOnTheScreen();
    await userEvent.setup().press(tab('tags'));
    await log.requested(MySavedRecipesDocument, 2);

    // The picker says so while it reads the rest.
    expect(screen.UNSAFE_getByType(TagPicker).props.loading).toBe(true);
  });

  it('offers the tags of every page once opened, and shows recipes with any picked', async () => {
    const { client } = openSaved({ answers: twoPages() });
    await log.landed(MySavedRecipesDocument);
    const user = userEvent.setup();

    await user.press(tab('tags'));
    await listHolds(client, 3);
    const picker = within(screen.UNSAFE_getByType(TagPicker));
    await user.press(picker.getByText('Party'));
    await user.press(picker.getByText('Vegan'));

    expect(shown()).toEqual(['Banana bread', 'Carrot cake']);
    expect(
      within(tab('tags')).getByText(t('recipes.tagCount', { count: 2 })),
    ).toBeTruthy();
  });
});
