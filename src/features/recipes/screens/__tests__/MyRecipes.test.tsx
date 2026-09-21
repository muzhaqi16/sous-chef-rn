import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { MyRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { MyRecipes } from '../MyRecipes';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: jest.fn(() => false),
}));
jest.mock('#features/recipes/components/MyRecipeCard', () => ({
  MyRecipeCard: () => null,
}));

function renderWithFailingSecondPage() {
  const firstPage = recordMock(MyRecipesDocument, {
    data: {
      recipes: {
        edges: [
          {
            cursor: 'page-1',
            node: { id: 'recipe-1', name: 'Apple pie', description: null },
          },
        ],
        pageInfo: { hasNextPage: true, endCursor: 'page-1' },
      },
    },
    maxUsageCount: 1,
  });
  const failedPage = recordMock(MyRecipesDocument, {
    error: new Error('page 2 failed'),
  });
  renderWithApollo(<MyRecipes />, {
    operationMocks: [firstPage.mock, failedPage.mock],
  });
  return failedPage;
}

describe('MyRecipes search over a page that fails to load', () => {
  it('says the results are incomplete instead of "No results"', async () => {
    const failedPage = renderWithFailingSecondPage();
    fireEvent.changeText(
      await screen.findByPlaceholderText('Search my recipes...'),
      'Banana',
    );

    await waitFor(() => expect(failedPage.fired.length).toBeGreaterThan(0));
    expect(
      await screen.findByText("Couldn't load all your recipes"),
    ).toBeTruthy();
    expect(screen.queryByText('No results for "Banana"')).toBeNull();
  });

  it('loads again for a new search term', async () => {
    const failedPage = renderWithFailingSecondPage();
    const search = await screen.findByPlaceholderText('Search my recipes...');
    fireEvent.changeText(search, 'Banana');
    await screen.findByText("Couldn't load all your recipes");
    const attempts = failedPage.fired.length;

    fireEvent.changeText(search, 'Cherry');

    await waitFor(() =>
      expect(failedPage.fired.length).toBeGreaterThan(attempts),
    );
  });

  // Rows that matched are shown, but the page that failed may hold more.
  it('flags the matches it shows as possibly incomplete, with a retry', async () => {
    const failedPage = renderWithFailingSecondPage();
    fireEvent.changeText(
      await screen.findByPlaceholderText('Search my recipes...'),
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
