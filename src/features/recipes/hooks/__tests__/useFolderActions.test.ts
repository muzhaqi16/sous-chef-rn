import { act } from '@testing-library/react-native';
import { InMemoryCache } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { DeleteRecipeFolderDocument } from '#features/recipes/graphql/recipe.generated';
import { useFolderActions } from '../useFolderActions';
import fragmentMatcherData from '#/graphql/generated/fragmentMatcher.json';

// Inline fragments on the Error interface require possibleTypes for the
// cache to keep `code`/`message` when the concrete return is a NotFoundError /
// ConflictError. The default test cache omits possibleTypes.
function makeCacheWithPossibleTypes() {
  return new InMemoryCache({
    possibleTypes: fragmentMatcherData.possibleTypes,
  });
}

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (
      ...args: Parameters<
        typeof import('#/services/toastService').toastService.success
      >
    ) => mockToastSuccess(...args),
    error: (
      ...args: Parameters<
        typeof import('#/services/toastService').toastService.error
      >
    ) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/utils/finallyHelpers');
jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useFolderActions', () => {
  describe('renameFolder', () => {
    it('returns false if oldName and newName are the same', async () => {
      const { result } = renderHookWithApollo(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('A', 'A');
      });

      expect(success).toBe(false);
    });

    it('returns false if oldName is empty', async () => {
      const { result } = renderHookWithApollo(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('', 'New');
      });

      expect(success).toBe(false);
    });

    it('calls mutation with moveTo and shows success toast', async () => {
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'DeleteRecipeFolderPayload',
            success: true,
          },
        },
      });

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('Old', 'New');
      });

      expect(success).toBe(true);
      expect(del.fired).toContainEqual({
        input: { folder: 'Old', moveTo: 'New' },
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Renamed "Old" to "New"'),
      );
    });

    it('returns false when mutation returns error union member', async () => {
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'NotFoundError',
            code: 'NOT_FOUND',
            message: 'Folder not found',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
        cache: makeCacheWithPossibleTypes(),
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('Old', 'New');
      });

      expect(success).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith('Folder not found');
    });
  });

  describe('deleteFolder', () => {
    it('returns false if folderName is empty', async () => {
      const { result } = renderHookWithApollo(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.deleteFolder('');
      });

      expect(success).toBe(false);
    });

    it('calls mutation and shows success toast on delete', async () => {
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'DeleteRecipeFolderPayload',
            success: true,
          },
        },
      });

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.deleteFolder('MyFolder');
      });

      expect(success).toBe(true);
      expect(del.fired).toContainEqual({ input: { folder: 'MyFolder' } });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Deleted "MyFolder"'),
      );
    });

    it('returns false when mutation returns error union member', async () => {
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'NotFoundError',
            code: 'NOT_FOUND',
            message: 'Folder not found',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
        cache: makeCacheWithPossibleTypes(),
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.deleteFolder('MyFolder');
      });

      // Production code returns false on non-Success union members.
      expect(success).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith('Folder not found');
    });
  });

  it('tracks loading state', () => {
    const { result } = renderHookWithApollo(() => useFolderActions());
    expect(result.current.loading).toBe(false);
  });
});

describe('folder actions move the recipes, not just the folder list', () => {
  const { gql } = require('@apollo/client');
  const {
    SavedRecipeFoldersDocument,
  } = require('#features/recipes/graphql/recipe.generated');

  const SAVED_RECIPE = gql`
    fragment SeedSavedRecipe on SavedRecipe {
      id
      folder
    }
  `;

  function seed(cache: InMemoryCache) {
    cache.writeQuery({
      query: SavedRecipeFoldersDocument,
      data: {
        __typename: 'Query',
        savedRecipeFolders: ['Weeknight', 'Favorites'],
      },
    });
    for (const id of ['saved-1', 'saved-2']) {
      cache.writeFragment({
        id: `SavedRecipe:${id}`,
        fragment: SAVED_RECIPE,
        data: { __typename: 'SavedRecipe', id, folder: 'Weeknight' },
      });
    }
    // A recipe in another folder must not be touched.
    cache.writeFragment({
      id: 'SavedRecipe:saved-3',
      fragment: SAVED_RECIPE,
      data: { __typename: 'SavedRecipe', id: 'saved-3', folder: 'Favorites' },
    });
  }

  const readFolder = (cache: InMemoryCache, id: string) =>
    (
      cache.readFragment({
        id: `SavedRecipe:${id}`,
        fragment: SAVED_RECIPE,
      }) as { folder: string | null } | null
    )?.folder;

  // Queued: the response that would reconcile `savedRecipes` never arrives,
  // so the local write is all the user has. This is the offline case.
  const queued = () =>
    recordMock(DeleteRecipeFolderDocument, {
      data: { deleteRecipeFolder: null },
    });

  it('carries the recipes to the new folder name on rename', async () => {
    const cache = makeCacheWithPossibleTypes();
    seed(cache);
    const mock = queued();

    const { result } = renderHookWithApollo(() => useFolderActions(), {
      cache,
      operationMocks: [mock.mock],
    });

    await act(async () => {
      await result.current.renameFolder('Weeknight', 'Weeknight Dinners');
    });

    // The screen filters `recipe.folder === selectedFolder`, so without this
    // the renamed folder renders empty under a success toast.
    expect(readFolder(cache, 'saved-1')).toBe('Weeknight Dinners');
    expect(readFolder(cache, 'saved-2')).toBe('Weeknight Dinners');
    expect(readFolder(cache, 'saved-3')).toBe('Favorites');
  });

  it('unfolders the recipes on delete', async () => {
    const cache = makeCacheWithPossibleTypes();
    seed(cache);
    const mock = queued();

    const { result } = renderHookWithApollo(() => useFolderActions(), {
      cache,
      operationMocks: [mock.mock],
    });

    await act(async () => {
      await result.current.deleteFolder('Weeknight');
    });

    expect(readFolder(cache, 'saved-1')).toBeNull();
    expect(readFolder(cache, 'saved-3')).toBe('Favorites');
  });

  it('puts the recipes back when the rename is refused', async () => {
    const cache = makeCacheWithPossibleTypes();
    seed(cache);
    const refused = recordMock(DeleteRecipeFolderDocument, {
      data: {
        deleteRecipeFolder: {
          __typename: 'ValidationError',
          message: 'nope',
          code: 'VALIDATION_ERROR',
        },
      },
    });

    const { result } = renderHookWithApollo(() => useFolderActions(), {
      cache,
      operationMocks: [refused.mock],
    });

    await act(async () => {
      await result.current.renameFolder('Weeknight', 'Weeknight Dinners');
    });

    expect(readFolder(cache, 'saved-1')).toBe('Weeknight');
    expect(readFolder(cache, 'saved-2')).toBe('Weeknight');
  });
});
