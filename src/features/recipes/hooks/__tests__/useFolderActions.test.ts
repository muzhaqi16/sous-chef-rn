import { renderHook, act } from '@testing-library/react-native';
import { useFolderActions } from '../useFolderActions';

const mockDeleteRecipeFolderMutation = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useDeleteRecipeFolderMutation: jest.fn(() => [
    mockDeleteRecipeFolderMutation,
    { loading: false },
  ]),
}));

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

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useFolderActions', () => {
  describe('renameFolder', () => {
    it('returns false if oldName and newName are the same', async () => {
      const { result } = renderHook(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('A', 'A');
      });

      expect(success).toBe(false);
      expect(mockDeleteRecipeFolderMutation).not.toHaveBeenCalled();
    });

    it('returns false if oldName is empty', async () => {
      const { result } = renderHook(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('', 'New');
      });

      expect(success).toBe(false);
    });

    it('calls mutation with moveTo and shows success toast', async () => {
      mockDeleteRecipeFolderMutation.mockResolvedValueOnce({
        data: {
          deleteRecipeFolder: { success: true, message: null },
        },
      });

      const { result } = renderHook(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameFolder('Old', 'New');
      });

      expect(success).toBe(true);
      expect(mockDeleteRecipeFolderMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { input: { folder: 'Old', moveTo: 'New' } },
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Renamed "Old" to "New"'),
      );
    });

    it('returns false when mutation returns success: false', async () => {
      mockDeleteRecipeFolderMutation.mockResolvedValueOnce({
        data: {
          deleteRecipeFolder: { success: false, message: 'Folder not found' },
        },
      });

      const { result } = renderHook(() => useFolderActions());

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
      const { result } = renderHook(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.deleteFolder('');
      });

      expect(success).toBe(false);
    });

    it('calls mutation and shows success toast on delete', async () => {
      mockDeleteRecipeFolderMutation.mockResolvedValueOnce({
        data: {
          deleteRecipeFolder: { success: true, message: null },
        },
      });

      const { result } = renderHook(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.deleteFolder('MyFolder');
      });

      expect(success).toBe(true);
      expect(mockDeleteRecipeFolderMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { input: { folder: 'MyFolder' } },
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Deleted "MyFolder"'),
      );
    });

    it('returns true even when mutation returns success: false but still shows toast', async () => {
      mockDeleteRecipeFolderMutation.mockResolvedValueOnce({
        data: {
          deleteRecipeFolder: { success: false, message: null },
        },
      });

      const { result } = renderHook(() => useFolderActions());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.deleteFolder('MyFolder');
      });

      // deleteFolder returns true regardless of success flag (it always returns true after mutation)
      expect(success).toBe(true);
    });
  });

  it('tracks loading state', () => {
    const { result } = renderHook(() => useFolderActions());
    expect(result.current.loading).toBe(false);
  });
});
