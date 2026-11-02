import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { MyRecipesDocument } from '../useRecipeManagement.generated';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { MyRecipes } from '../MyRecipes';

// Its midnight timer re-arms itself, so a mounted watch never drains.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));

// Its repeating diagnostics timer never drains: 0 is the hook's own off switch.
jest.mock('#hooks/performance/useFlashListPerformance', () => {
  const actual = jest.requireActual(
    '#hooks/performance/useFlashListPerformance',
  );
  return {
    ...actual,
    useFlashListPerformance: (list: unknown, options: object) =>
      actual.useFlashListPerformance(list, { ...options, reportInterval: 0 }),
  };
});

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
            node: { id: 'recipe-1', name: 'Apple pie' },
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MyRecipes search over a page that fails to load', () => {
  it('says the results are incomplete instead of "No results"', async () => {
    const failedPage = renderWithFailingSecondPage();
    await drainTimers();
    fireEvent.changeText(
      screen.getByPlaceholderText('Search my recipes...'),
      'Banana',
    );

    await drainTimers();
    expect(failedPage.fired.length).toBeGreaterThan(0);
    await drainTimers();
    expect(screen.getByText("Couldn't load all your recipes")).toBeTruthy();
    expect(screen.queryByText('No results for "Banana"')).toBeNull();
  });

  it('loads again for a new search term', async () => {
    const failedPage = renderWithFailingSecondPage();
    await drainTimers();
    const search = screen.getByPlaceholderText('Search my recipes...');
    fireEvent.changeText(search, 'Banana');
    await drainTimers();
    expect(screen.getByText("Couldn't load all your recipes")).toBeTruthy();
    const attempts = failedPage.fired.length;

    fireEvent.changeText(search, 'Cherry');

    await drainTimers();
    expect(failedPage.fired.length).toBeGreaterThan(attempts);
  });

  // Rows that matched are shown, but the page that failed may hold more.
  it('flags the matches it shows as possibly incomplete, with a retry', async () => {
    const failedPage = renderWithFailingSecondPage();
    await drainTimers();
    fireEvent.changeText(
      screen.getByPlaceholderText('Search my recipes...'),
      'Apple',
    );
    await drainTimers();
    const notice = screen.getByTestId(recipesTestIDs.searchIncompleteNotice);
    expect(notice).toBeTruthy();
    const attempts = failedPage.fired.length;

    fireEvent.press(screen.getByTestId(recipesTestIDs.searchIncompleteRetry));

    await drainTimers();
    expect(failedPage.fired.length).toBeGreaterThan(attempts);
  });
});
