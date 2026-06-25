import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { RemoveRecipeFromFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import {
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useRecipeSavedMetadata } from '../useRecipeSavedMetadata';

// Reads just enough off the cached Recipe to assert the optimistic un-save.
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
    | { __typename: 'UnfavoriteRecipePayload' }
    | { __typename: 'ForbiddenError' },
): MockedResponse => ({
  request: {
    query: RemoveRecipeFromFavoritesDocument,
    variables: () => true,
  },
  result: {
    data: {
      removeRecipeFromFavorites:
        member.__typename === 'UnfavoriteRecipePayload'
          ? {
              __typename: 'UnfavoriteRecipePayload',
              savedRecipe: { __typename: 'SavedRecipe', id: 'sr1' },
            }
          : { __typename: 'ForbiddenError', code: 'FORBIDDEN', message: 'no' },
    },
  },
});

describe('useRecipeSavedMetadata — offline unfavorite', () => {
  it('optimistically clears Recipe.savedDetails and calls onUnfavoriteSuccess', async () => {
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
          unfavoriteMock({ __typename: 'UnfavoriteRecipePayload' }),
        ],
      },
    );

    await act(async () => {
      await result.current.handleUnfavoriteRecipe();
    });

    expect(readSavedDetails(cache)).toBeNull();
    expect(onUnfavoriteSuccess).toHaveBeenCalledTimes(1);
  });

  it('reverts savedDetails (and skips onUnfavoriteSuccess) when the server rejects', async () => {
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

    // The optimistic clear is reverted from the snapshot.
    expect(readSavedDetails(cache)).toEqual(
      expect.objectContaining({ id: 'sr1' }),
    );
    expect(onUnfavoriteSuccess).not.toHaveBeenCalled();
  });
});
