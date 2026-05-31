import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { useRecipeData } from '../useRecipeData';
import type { useRecipeFavoriteState } from '../useRecipeFavoriteState';
import type { useRecipePreload } from '#features/recipes/hooks/useRecipePreload';
import type { useRecipeShoppingList } from '../useRecipeShoppingList';
import type { useRecipeCookingActions } from '../useRecipeCookingActions';
import type { useRecipeSavedMetadata } from '../useRecipeSavedMetadata';
import { useRecipeDetail } from '../useRecipeDetail';

type PreloadedRecipe = ReturnType<typeof useRecipePreload>['preloadedRecipe'];
type BackendRecipe = ReturnType<typeof useRecipeData>['backendRecipe'];

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: mockGoBack }),
}));

const mockRecipeDataReturn = {
  displayData: null,
  loading: false,
  error: null,
  backendError: undefined,
  backendRecipe: undefined as BackendRecipe,
  isBackendRecipe: false,
  externalRecipe: null,
};
const mockUseRecipeData = jest.fn<
  typeof mockRecipeDataReturn,
  Parameters<typeof useRecipeData>
>(() => mockRecipeDataReturn);
jest.mock('../useRecipeData', () => ({
  useRecipeData: (...args: Parameters<typeof useRecipeData>) =>
    mockUseRecipeData(...args),
}));

const mockFavoriteStateReturn = {
  isSaved: false,
  saving: false,
  savedFolderLocal: null as string | null,
  handleSaveRecipe: jest.fn(),
  setRecipeSaved: jest.fn(),
  setSavedFolderLocal: jest.fn(),
};
const mockUseRecipeFavoriteState = jest.fn<
  typeof mockFavoriteStateReturn,
  Parameters<typeof useRecipeFavoriteState>
>(() => mockFavoriteStateReturn);
jest.mock('../useRecipeFavoriteState', () => ({
  useRecipeFavoriteState: (
    ...args: Parameters<typeof useRecipeFavoriteState>
  ) => mockUseRecipeFavoriteState(...args),
}));

const mockPreloadReturn = {
  preloading: false,
  preloadedRecipe: null as PreloadedRecipe,
  preloadRecipe: jest.fn(),
  saveRecipeToFavorites: jest.fn(),
  savingToFavorites: false,
};
const mockUseRecipePreload = jest.fn<
  typeof mockPreloadReturn,
  Parameters<typeof useRecipePreload>
>(() => mockPreloadReturn);
jest.mock('#features/recipes/hooks/useRecipePreload', () => ({
  useRecipePreload: (...args: Parameters<typeof useRecipePreload>) =>
    mockUseRecipePreload(...args),
}));

const mockShoppingListReturn = { shoppingListSpecific: 'shopping' };
const mockUseRecipeShoppingList = jest.fn<
  typeof mockShoppingListReturn,
  Parameters<typeof useRecipeShoppingList>
>(() => mockShoppingListReturn);
jest.mock('../useRecipeShoppingList', () => ({
  useRecipeShoppingList: (...args: Parameters<typeof useRecipeShoppingList>) =>
    mockUseRecipeShoppingList(...args),
}));

const mockCookingActionsReturn = { cookingSpecific: 'cooking' };
const mockUseRecipeCookingActions = jest.fn<
  typeof mockCookingActionsReturn,
  Parameters<typeof useRecipeCookingActions>
>(() => mockCookingActionsReturn);
jest.mock('../useRecipeCookingActions', () => ({
  useRecipeCookingActions: (
    ...args: Parameters<typeof useRecipeCookingActions>
  ) => mockUseRecipeCookingActions(...args),
}));

const mockSavedMetadataReturn = {
  showFolderPicker: false,
  setShowFolderPicker: jest.fn(),
  updatingFolderTags: false,
  handleUpdateFolder: jest.fn(),
  handleUpdateTags: jest.fn(),
  handleUpdateNotes: jest.fn(),
  handleUpdateRating: jest.fn(),
  handleUnfavoriteRecipe: jest.fn(),
};
const mockUseRecipeSavedMetadata = jest.fn<
  typeof mockSavedMetadataReturn,
  Parameters<typeof useRecipeSavedMetadata>
>(() => mockSavedMetadataReturn);
jest.mock('../useRecipeSavedMetadata', () => ({
  useRecipeSavedMetadata: (
    ...args: Parameters<typeof useRecipeSavedMetadata>
  ) => mockUseRecipeSavedMetadata(...args),
}));

const { useRoute } = jest.requireMock('@react-navigation/native') as {
  useRoute: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  useRoute.mockReturnValue({ params: {} });
});

describe('useRecipeDetail (orchestrator wiring)', () => {
  it('threads route params to useRecipeData', () => {
    useRoute.mockReturnValueOnce({
      params: { recipeId: 'r1', externalSource: 'X', externalId: '99' },
    });

    renderHookWithApollo(() => useRecipeDetail());

    expect(mockUseRecipeData).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: 'r1',
        externalSource: 'X',
        externalId: '99',
      }),
    );
  });

  it('passes preloadRecipe from useRecipePreload into useRecipeData', () => {
    renderHookWithApollo(() => useRecipeDetail());

    expect(mockUseRecipeData).toHaveBeenCalledWith(
      expect.objectContaining({
        preloadRecipe: mockPreloadReturn.preloadRecipe,
      }),
    );
  });

  it('passes useRecipeData outputs into useRecipeFavoriteState', () => {
    renderHookWithApollo(() => useRecipeDetail());

    expect(mockUseRecipeFavoriteState).toHaveBeenCalledWith(
      expect.objectContaining({
        externalRecipe: mockRecipeDataReturn.externalRecipe,
        isBackendRecipe: mockRecipeDataReturn.isBackendRecipe,
        backendRecipe: mockRecipeDataReturn.backendRecipe,
        saveRecipeToFavorites: mockPreloadReturn.saveRecipeToFavorites,
        savingToFavorites: mockPreloadReturn.savingToFavorites,
      }),
    );
  });

  it('passes useRecipeData outputs into useRecipeShoppingList', () => {
    useRoute.mockReturnValueOnce({ params: { recipeId: 'r1' } });

    renderHookWithApollo(() => useRecipeDetail());

    expect(mockUseRecipeShoppingList).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: 'r1',
        isBackendRecipe: mockRecipeDataReturn.isBackendRecipe,
        backendRecipe: mockRecipeDataReturn.backendRecipe,
        externalRecipe: mockRecipeDataReturn.externalRecipe,
      }),
    );
  });

  it('passes preloadedRecipe id into useRecipeSavedMetadata', () => {
    mockUseRecipePreload.mockReturnValueOnce({
      ...mockPreloadReturn,
      preloadedRecipe: {
        id: 'preloaded-1',
      } as Partial<NonNullable<PreloadedRecipe>> as PreloadedRecipe,
    });
    useRoute.mockReturnValueOnce({ params: { recipeId: 'r1' } });

    renderHookWithApollo(() => useRecipeDetail());

    expect(mockUseRecipeSavedMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: 'r1',
        preloadedRecipeId: 'preloaded-1',
      }),
    );
  });

  it('returns the merged shopping-list and cooking outputs in the result', () => {
    const { result } = renderHookWithApollo(() => useRecipeDetail());

    expect(result.current).toEqual(
      expect.objectContaining({
        shoppingListSpecific: 'shopping',
        cookingSpecific: 'cooking',
      }),
    );
  });

  it('exposes savedMetadata fields and unfavorite handler', () => {
    const { result } = renderHookWithApollo(() => useRecipeDetail());

    expect(result.current.handleUpdateFolder).toBe(
      mockSavedMetadataReturn.handleUpdateFolder,
    );
    expect(result.current.handleUnfavoriteRecipe).toBe(
      mockSavedMetadataReturn.handleUnfavoriteRecipe,
    );
  });

  it('exposes goBack from navigation', () => {
    const { result } = renderHookWithApollo(() => useRecipeDetail());
    result.current.goBack();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('reads savedFolder from backend.savedDetails when isBackendRecipe', () => {
    mockUseRecipeData.mockReturnValueOnce({
      ...mockRecipeDataReturn,
      isBackendRecipe: true,
      backendRecipe: {
        id: 'r1',
        savedDetails: {
          folder: 'Backend Folder',
          tags: ['t1'],
          notes: 'n',
          personalRating: 5,
          cookedCount: 3,
        },
      } as Partial<NonNullable<BackendRecipe>> as BackendRecipe,
    });

    const { result } = renderHookWithApollo(() => useRecipeDetail());

    expect(result.current.savedFolder).toBe('Backend Folder');
    expect(result.current.savedTags).toEqual(['t1']);
    expect(result.current.savedNotes).toBe('n');
    expect(result.current.savedRating).toBe(5);
    expect(result.current.cookedCount).toBe(3);
  });

  it('reads savedFolder from favorites.savedFolderLocal when not isBackendRecipe', () => {
    mockUseRecipeFavoriteState.mockReturnValueOnce({
      ...mockFavoriteStateReturn,
      savedFolderLocal: 'Local Folder',
    });

    const { result } = renderHookWithApollo(() => useRecipeDetail());

    expect(result.current.savedFolder).toBe('Local Folder');
  });

  it('exposes preload state', () => {
    mockUseRecipePreload.mockReturnValueOnce({
      ...mockPreloadReturn,
      preloading: true,
      preloadedRecipe: {
        id: 'preloaded-1',
      } as Partial<NonNullable<PreloadedRecipe>> as PreloadedRecipe,
    });

    const { result } = renderHookWithApollo(() => useRecipeDetail());

    expect(result.current.preloading).toBe(true);
    expect(result.current.preloadedRecipe).toEqual({ id: 'preloaded-1' });
  });
});
