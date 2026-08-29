import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { RemoveRecipeFromFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import type { RootState } from '#store';
import { useRecipeSavedMetadata } from '../useRecipeSavedMetadata';

// `useIsApiUnavailable` reads the network signals off the store, so the state is
// mutable per test — `apiReachable: false` is what the online-only guard keys on.
const mockStoreState = { isOnline: true, apiReachable: true };

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector(mockStoreState as RootState),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

beforeEach(() => {
  mockStoreState.isOnline = true;
  mockStoreState.apiReachable = true;
  mockToastSuccess.mockClear();
  mockToastError.mockClear();
});

// Reads just enough off the cached Recipe to assert the un-save.
const SAVED_DETAILS_FRAGMENT = gql`
  fragment _TestSavedDetails on Recipe {
    id
    savedDetails {
      id
    }
  }
`;

function seedRecipeWithSavedDetails() {
  return seedCache([
    {
      __typename: 'Recipe',
      id: 'r1',
      savedDetails: { __typename: 'SavedRecipe', id: 'sr1' },
    },
  ]);
}

const readSavedDetails = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ savedDetails: { id: string } | null }>({
    id: 'Recipe:r1',
    fragment: SAVED_DETAILS_FRAGMENT,
  })?.savedDetails;

/** Mock the unfavorite resolving as the success payload or a rejected member. */
const unfavoriteMock = (
  member:
    | { __typename: 'RemoveRecipeFromFavoritesPayload' }
    | { __typename: 'ForbiddenError' },
): MockedResponse => ({
  request: {
    query: RemoveRecipeFromFavoritesDocument,
    variables: () => true,
  },
  result: {
    data: {
      removeRecipeFromFavorites:
        member.__typename === 'RemoveRecipeFromFavoritesPayload'
          ? {
              __typename: 'RemoveRecipeFromFavoritesPayload',
              savedRecipe: { __typename: 'SavedRecipe', id: 'sr1' },
            }
          : { __typename: 'ForbiddenError', code: 'FORBIDDEN', message: 'no' },
    },
  },
});

describe('useRecipeSavedMetadata — online-only unfavorite', () => {
  it("clears Recipe.savedDetails from the server's response and calls onUnfavoriteSuccess", async () => {
    const cache = seedRecipeWithSavedDetails();
    const onUnfavoriteSuccess = jest.fn();
    const { result } = renderHookWithApollo(
      () =>
        useRecipeSavedMetadata({
          recipeId: 'r1',
          preloadedRecipeId: undefined,
          onUnfavoriteSuccess,
        }),
      {
        cache,
        operationMocks: [
          unfavoriteMock({ __typename: 'RemoveRecipeFromFavoritesPayload' }),
        ],
      },
    );

    await act(async () => {
      await result.current.handleUnfavoriteRecipe();
    });

    expect(readSavedDetails(cache)).toBeNull();
    expect(onUnfavoriteSuccess).toHaveBeenCalledTimes(1);
  });

  it('leaves savedDetails intact (and skips onUnfavoriteSuccess) when the server rejects', async () => {
    const cache = seedRecipeWithSavedDetails();
    const onUnfavoriteSuccess = jest.fn();
    const { result } = renderHookWithApollo(
      () =>
        useRecipeSavedMetadata({
          recipeId: 'r1',
          preloadedRecipeId: undefined,
          onUnfavoriteSuccess,
        }),
      {
        cache,
        operationMocks: [unfavoriteMock({ __typename: 'ForbiddenError' })],
      },
    );

    await act(async () => {
      await result.current.handleUnfavoriteRecipe();
    });

    // Nothing was written ahead of the response, so there is nothing to revert.
    expect(readSavedDetails(cache)).toEqual(
      expect.objectContaining({ id: 'sr1' }),
    );
    expect(onUnfavoriteSuccess).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });

  it('refuses the unfavorite while the API is unavailable', async () => {
    mockStoreState.apiReachable = false;
    const cache = seedRecipeWithSavedDetails();
    const onUnfavoriteSuccess = jest.fn();
    const unfavorite = recordMock(RemoveRecipeFromFavoritesDocument, {
      data: {
        removeRecipeFromFavorites: {
          __typename: 'RemoveRecipeFromFavoritesPayload',
          savedRecipe: { __typename: 'SavedRecipe', id: 'sr1' },
        },
      },
    });

    const { result } = renderHookWithApollo(
      () =>
        useRecipeSavedMetadata({
          recipeId: 'r1',
          preloadedRecipeId: undefined,
          onUnfavoriteSuccess,
        }),
      { cache, operationMocks: [unfavorite.mock] },
    );

    expect(result.current.isApiUnavailable).toBe(true);

    await act(async () => {
      await result.current.handleUnfavoriteRecipe();
    });

    expect(mockToastError).toHaveBeenCalledWith('Not available offline');
    expect(unfavorite.fired).toHaveLength(0);
    expect(onUnfavoriteSuccess).not.toHaveBeenCalled();
    // The saved row stays put — no offline write happens any more.
    expect(readSavedDetails(cache)).toEqual(
      expect.objectContaining({ id: 'sr1' }),
    );
  });
});

describe('useRecipeSavedMetadata — online-only metadata edits', () => {
  it('refuses a folder change while the API is unavailable', async () => {
    mockStoreState.apiReachable = false;
    const { result } = renderHookWithApollo(() =>
      useRecipeSavedMetadata({
        recipeId: 'r1',
        preloadedRecipeId: undefined,
        onUnfavoriteSuccess: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleUpdateFolder('Weeknights');
    });

    expect(mockToastError).toHaveBeenCalledWith('Not available offline');
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // The picker still closes — the refusal is reported, not the tap swallowed.
    await waitFor(() => expect(result.current.showFolderPicker).toBe(false));
  });

  it('refuses tag, note and rating edits while the API is unavailable', async () => {
    mockStoreState.apiReachable = false;
    const { result } = renderHookWithApollo(() =>
      useRecipeSavedMetadata({
        recipeId: 'r1',
        preloadedRecipeId: undefined,
        onUnfavoriteSuccess: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleUpdateTags(['quick']);
      await result.current.handleUpdateNotes('note');
      await result.current.handleUpdateRating(4);
    });

    expect(mockToastError).toHaveBeenCalledTimes(3);
    expect(mockToastError).toHaveBeenCalledWith('Not available offline');
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
