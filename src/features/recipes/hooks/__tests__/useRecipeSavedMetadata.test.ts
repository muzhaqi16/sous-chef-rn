import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  RemoveRecipeFromFavoritesDocument,
  UpdateFavoriteRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { toastService } from '#/services/toastService';
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

describe('useRecipeSavedMetadata — clearing an optional field', () => {
  /** A saved recipe sitting in a folder, with notes. */
  function seedSavedRecipe() {
    return seedCache([
      {
        __typename: 'Recipe',
        id: 'r1',
        savedDetails: {
          __typename: 'SavedRecipe',
          id: 'sr1',
          folder: 'Weeknight',
          notes: 'Add chilli',
          tags: [],
          personalRating: null,
        },
      },
    ]);
  }

  function updateMock() {
    return recordMock(UpdateFavoriteRecipeDocument, {
      data: {
        updateFavoriteRecipe: {
          __typename: 'UpdateFavoriteRecipePayload',
          savedRecipe: { __typename: 'SavedRecipe', id: 'sr1' },
        },
      },
    });
  }

  function renderWith(mock: MockedResponse) {
    return renderHookWithApollo(
      () =>
        useRecipeSavedMetadata({
          recipeId: 'r1',
          preloadedRecipeId: undefined,
          onUnfavoriteSuccess: jest.fn(),
        }),
      { cache: seedSavedRecipe(), operationMocks: [mock] },
    );
  }

  it('sends an explicit null when the folder is removed', async () => {
    // `folder ?? undefined` was dropped from the serialized variables, and an
    // absent key means "leave unchanged" — so the server never cleared it and
    // the mutation's own `update` wrote the old folder back over the row.
    const update = updateMock();
    const { result } = renderWith(update.mock);

    await act(async () => {
      await result.current.handleUpdateFolder(null);
    });

    expect(update.fired[0]).toEqual({
      input: expect.objectContaining({ recipeId: 'r1', folder: null }),
    });
  });

  it('keeps the folder name when one is chosen', async () => {
    const update = updateMock();
    const { result } = renderWith(update.mock);

    await act(async () => {
      await result.current.handleUpdateFolder('Sunday');
    });

    expect(update.fired[0]).toEqual({
      input: expect.objectContaining({ folder: 'Sunday' }),
    });
  });

  it('sends an explicit null when notes are emptied', async () => {
    const update = updateMock();
    const { result } = renderWith(update.mock);

    await act(async () => {
      await result.current.handleUpdateNotes('');
    });

    expect(update.fired[0]).toEqual({
      input: expect.objectContaining({ notes: null }),
    });
  });

  it('does not report success when the write was refused', async () => {
    // The helper reverts the cache on a refusal. A success toast fired anyway
    // told the user the opposite of what had just happened.
    const successToast = jest.spyOn(toastService, 'success');
    const errorToast = jest.spyOn(toastService, 'error');
    const refused = recordMock(UpdateFavoriteRecipeDocument, {
      error: new Error('refused'),
    });

    const { result } = renderWith(refused.mock);

    await act(async () => {
      await result.current.handleUpdateFolder(null);
    });

    expect(successToast).not.toHaveBeenCalled();
    expect(errorToast).toHaveBeenCalledTimes(1);
  });
});
