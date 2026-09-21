import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
} from '#features/recipes/graphql/recipe.generated';
import type { TagPickerProps } from '#features/recipes/components/TagPicker';
import { kitTestIDs } from '#components/testIDs';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { SavedRecipes } from '../SavedRecipes';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: jest.fn(() => false),
}));
jest.mock('#features/recipes/components/SavedRecipeCard', () => ({
  SavedRecipeCard: () => null,
}));
jest.mock('#features/recipes/components/FolderPicker', () => ({
  FolderPicker: () => null,
}));
jest.mock('#features/recipes/components/TagPicker', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    TagPicker: ({ visible, tags, loading }: TagPickerProps) =>
      visible ? (
        <MockText testID="tag-picker-probe">
          {loading ? 'loading' : tags.join(',')}
        </MockText>
      ) : null,
  };
});

function savedPage(
  edges: Array<{ id: string; tags: string[] }>,
  endCursor: string | null,
) {
  return {
    me: {
      id: 'user-1',
      savedRecipesConnection: {
        edges: edges.map(edge => ({
          cursor: edge.id,
          node: {
            id: edge.id,
            folder: null,
            tags: edge.tags,
            recipe: {
              id: `recipe-${edge.id}`,
              name: edge.id,
              description: null,
            },
          },
        })),
        pageInfo: { hasNextPage: endCursor !== null, endCursor },
      },
    },
  };
}

describe('SavedRecipes tag filter', () => {
  it('loads the remaining pages when the tag picker opens, so a tag used only on page 2 is offered', async () => {
    const saved = recordMock(MySavedRecipesDocument, {
      dataFor: (vars): MockDataFor<typeof MySavedRecipesDocument> =>
        vars.after === 'page-1'
          ? savedPage([{ id: 'sr-2', tags: ['Vegan'] }], null)
          : savedPage([{ id: 'sr-1', tags: [] }], 'page-1'),
    });
    const folders = recordMock(SavedRecipeFoldersDocument, {
      data: { savedRecipeFolders: [] },
    });

    renderWithApollo(<SavedRecipes />, {
      operationMocks: [saved.mock, folders.mock],
    });

    const tagsTab = await screen.findByTestId(
      kitTestIDs.filterTab(recipesTestIDs.savedRecipesFilterTabPrefix, 'tags'),
    );
    expect(saved.fired.some(vars => vars.after)).toBe(false);

    fireEvent.press(tagsTab);

    await waitFor(() =>
      expect(screen.getByTestId('tag-picker-probe')).toHaveTextContent('Vegan'),
    );
    expect(saved.fired.some(vars => vars.after === 'page-1')).toBe(true);
    expect(screen.queryByText('loading')).toBeNull();
  });
});

describe('SavedRecipes search over a page that fails to load', () => {
  function renderWithFailingSecondPage() {
    const saved = recordMock(MySavedRecipesDocument, {
      data: savedPage([{ id: 'Apple pie', tags: [] }], 'page-1'),
      maxUsageCount: 1,
    });
    const failedPage = recordMock(MySavedRecipesDocument, {
      error: new Error('page 2 failed'),
    });
    const folders = recordMock(SavedRecipeFoldersDocument, {
      data: { savedRecipeFolders: [] },
    });
    renderWithApollo(<SavedRecipes />, {
      operationMocks: [saved.mock, failedPage.mock, folders.mock],
    });
    return failedPage;
  }

  it('says the results are incomplete instead of "No results"', async () => {
    const failedPage = renderWithFailingSecondPage();
    fireEvent.changeText(
      await screen.findByPlaceholderText('Search saved recipes...'),
      'Banana',
    );

    await waitFor(() => expect(failedPage.fired.length).toBeGreaterThan(0));
    expect(
      await screen.findByText("Couldn't load all your recipes"),
    ).toBeTruthy();
    expect(screen.queryByText('No results for "Banana"')).toBeNull();
  });

  it('loads again when the reader retries', async () => {
    const failedPage = renderWithFailingSecondPage();
    fireEvent.changeText(
      await screen.findByPlaceholderText('Search saved recipes...'),
      'Banana',
    );
    await screen.findByText("Couldn't load all your recipes");
    const attempts = failedPage.fired.length;

    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() =>
      expect(failedPage.fired.length).toBeGreaterThan(attempts),
    );
  });
  // Rows that matched are shown, but the page that failed may hold more.
  it('flags the matches it shows as possibly incomplete, with a retry', async () => {
    const failedPage = renderWithFailingSecondPage();
    fireEvent.changeText(
      await screen.findByPlaceholderText('Search saved recipes...'),
      'Apple',
    );
    const notice = await screen.findByTestId(
      recipesTestIDs.searchIncompleteNotice,
    );
    expect(notice).toBeTruthy();
    const attempts = failedPage.fired.length;

    fireEvent.press(screen.getByTestId(recipesTestIDs.searchIncompleteRetry));

    await waitFor(() =>
      expect(failedPage.fired.length).toBeGreaterThan(attempts),
    );
  });
});
