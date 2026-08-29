import { act } from '@testing-library/react-native';
import { InMemoryCache } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  DeleteRecipeFolderDocument,
  SavedRecipeFoldersDocument,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { useStore } from '#store';
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

afterEach(() => {
  useStore.setState({ apiReachable: true, isOnline: true });
});

function seededFolderCache(folders: string[]) {
  const cache = makeCacheWithPossibleTypes();
  cache.writeQuery<SavedRecipeFoldersQuery>({
    query: SavedRecipeFoldersDocument,
    data: { __typename: 'Query', savedRecipeFolders: folders },
  });
  return cache;
}

function readFolders(cache: InMemoryCache) {
  return cache.readQuery<SavedRecipeFoldersQuery>({
    query: SavedRecipeFoldersDocument,
  })?.savedRecipeFolders;
}

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

  describe('when the API is unavailable', () => {
    it('refuses a rename, toasts, and never fires the mutation', async () => {
      useStore.setState({ apiReachable: false });
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'DeleteRecipeFolderPayload',
            folder: 'Old',
            movedCount: 0,
          },
        },
      });
      const cache = seededFolderCache(['Old', 'Other']);

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
        cache,
      });

      expect(result.current.isApiUnavailable).toBe(true);

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('Old', 'New');
      });

      expect(success).toBe(false);
      expect(del.fired).toHaveLength(0);
      expect(mockToastError).toHaveBeenCalledWith('Not available offline');
      // No optimistic write survives the refusal.
      expect(readFolders(cache)).toEqual(['Old', 'Other']);
    });

    it('refuses a delete, toasts, and never fires the mutation', async () => {
      useStore.setState({ apiReachable: false });
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'DeleteRecipeFolderPayload',
            folder: 'MyFolder',
            movedCount: 0,
          },
        },
      });
      const cache = seededFolderCache(['MyFolder', 'Other']);

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
        cache,
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.deleteFolder('MyFolder');
      });

      expect(success).toBe(false);
      expect(del.fired).toHaveLength(0);
      expect(mockToastError).toHaveBeenCalledWith('Not available offline');
      expect(readFolders(cache)).toEqual(['MyFolder', 'Other']);
    });
  });

  describe('cache reconciliation on an accepted result', () => {
    it('renames the folder in the cached list only after the server accepts', async () => {
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'DeleteRecipeFolderPayload',
            folder: 'Old',
            movedCount: 2,
          },
        },
      });
      const cache = seededFolderCache(['Old', 'Other']);

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
        cache,
      });

      expect(result.current.isApiUnavailable).toBe(false);

      await act(async () => {
        await result.current.renameFolder('Old', 'New');
      });

      expect(readFolders(cache)).toEqual(['New', 'Other']);
    });

    it('leaves the cached list untouched when the server refuses', async () => {
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'NotFoundError',
            code: 'NOT_FOUND',
            message: 'Folder not found',
          },
        },
      });
      const cache = seededFolderCache(['MyFolder', 'Other']);

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
        cache,
      });

      await act(async () => {
        await result.current.deleteFolder('MyFolder');
      });

      expect(readFolders(cache)).toEqual(['MyFolder', 'Other']);
    });

    it('drops the folder from the cached list on an accepted delete', async () => {
      const del = recordMock(DeleteRecipeFolderDocument, {
        data: {
          deleteRecipeFolder: {
            __typename: 'DeleteRecipeFolderPayload',
            folder: 'MyFolder',
            movedCount: 0,
          },
        },
      });
      const cache = seededFolderCache(['MyFolder', 'Other']);

      const { result } = renderHookWithApollo(() => useFolderActions(), {
        operationMocks: [del.mock],
        cache,
      });

      await act(async () => {
        await result.current.deleteFolder('MyFolder');
      });

      expect(readFolders(cache)).toEqual(['Other']);
    });
  });

  it('tracks loading state', () => {
    const { result } = renderHookWithApollo(() => useFolderActions());
    expect(result.current.loading).toBe(false);
  });
});
