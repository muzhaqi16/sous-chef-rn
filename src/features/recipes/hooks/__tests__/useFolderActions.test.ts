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
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');
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
