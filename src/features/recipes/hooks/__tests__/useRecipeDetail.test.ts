import { act, waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { useRecipeData } from '../useRecipeData';
import type { useRecipeFavoriteState } from '../useRecipeFavoriteState';
import type { useRecipeShoppingList } from '../useRecipeShoppingList';
import type { useRecipeCookingActions } from '../useRecipeCookingActions';
import type { useRecipeSavedMetadata } from '../useRecipeSavedMetadata';
import type {
  CatalogRecipeHint,
  OpenedCatalogRecipe,
} from '../useOpenCatalogRecipe';
import { useRecipeDetail } from '../useRecipeDetail';

type RecipeData = ReturnType<typeof useRecipeData>;
type BackendRecipe = RecipeData['backendRecipe'];

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: mockGoBack }),
}));

const mockOpenCatalogRecipe = jest.fn<
  Promise<OpenedCatalogRecipe>,
  [CatalogRecipeHint]
>(() => Promise.resolve({ opened: true, recipeId: 'catalog-1' }));
jest.mock('../useOpenCatalogRecipe', () => ({
  useOpenCatalogRecipe: () => ({ openCatalogRecipe: mockOpenCatalogRecipe }),
}));

const mockRefetch = jest.fn();
const mockRecipeDataReturn: RecipeData = {
  displayData: null,
  loading: false,
  error: null,
  backendRecipe: undefined,
  refetch: mockRefetch,
};
const mockUseRecipeData = jest.fn<RecipeData, Parameters<typeof useRecipeData>>(
  () => mockRecipeDataReturn,
);
jest.mock('../useRecipeData', () => ({
  useRecipeData: (...args: Parameters<typeof useRecipeData>) =>
    mockUseRecipeData(...args),
}));

const mockFavoriteStateReturn = {
  isSaved: false,
  saving: false,
  handleSaveRecipe: jest.fn(),
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

const { useRoute } = jest.requireMock('@react-navigation/native');

// One object across renders, as the route's params are.
const HINT: CatalogRecipeHint = {
  externalId: '716429',
  name: 'Pasta with Garlic',
  imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
};

// The orchestrator reads only these off the loaded recipe.
const backendRecipe = (
  fields: Partial<NonNullable<BackendRecipe>>,
): BackendRecipe =>
  ({ id: 'r1', ...fields } as Partial<
    NonNullable<BackendRecipe>
  > as BackendRecipe);

/** The `onSaved` the orchestrator handed the favorite hook on its last render. */
const lastOnSaved = () => {
  const [params] = mockUseRecipeFavoriteState.mock.calls.at(-1) ?? [];
  if (!params) throw new Error('useRecipeFavoriteState was not called');
  return params.onSaved;
};

beforeEach(() => {
  jest.clearAllMocks();
  useRoute.mockReturnValue({ params: {} });
  mockUseRecipeData.mockImplementation(() => mockRecipeDataReturn);
});

describe('useRecipeDetail', () => {
  describe('a recipe opened by id', () => {
    it('loads it by that id and never opens a catalog recipe', () => {
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      renderHookWithApollo(() => useRecipeDetail());

      expect(mockUseRecipeData).toHaveBeenLastCalledWith({
        recipeId: 'r1',
        hint: undefined,
        openFailure: null,
      });
      expect(mockOpenCatalogRecipe).not.toHaveBeenCalled();
    });

    it('keeps the route id even when a catalog hint came with it', () => {
      useRoute.mockReturnValue({ params: { recipeId: 'r1', catalog: HINT } });

      renderHookWithApollo(() => useRecipeDetail());

      expect(mockOpenCatalogRecipe).not.toHaveBeenCalled();
      expect(mockUseRecipeData).toHaveBeenLastCalledWith(
        expect.objectContaining({ recipeId: 'r1' }),
      );
    });

    it('threads the id to every sub-hook', () => {
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      renderHookWithApollo(() => useRecipeDetail());

      expect(mockUseRecipeCookingActions).toHaveBeenLastCalledWith({
        recipeId: 'r1',
      });
      expect(mockUseRecipeShoppingList).toHaveBeenLastCalledWith({
        recipeId: 'r1',
        backendRecipe: undefined,
      });
      expect(mockUseRecipeSavedMetadata).toHaveBeenLastCalledWith({
        recipeId: 'r1',
      });
    });
  });

  describe('a catalog recipe opened from a row', () => {
    it('shows the row until its id arrives, then loads the recipe by it', async () => {
      useRoute.mockReturnValue({ params: { catalog: HINT } });

      const { result } = renderHookWithApollo(() => useRecipeDetail());

      expect(mockUseRecipeData).toHaveBeenCalledWith({
        recipeId: undefined,
        hint: HINT,
        openFailure: null,
      });
      await waitFor(() =>
        expect(mockUseRecipeData).toHaveBeenLastCalledWith({
          recipeId: 'catalog-1',
          hint: HINT,
          openFailure: null,
        }),
      );
      expect(mockOpenCatalogRecipe).toHaveBeenCalledWith(HINT);
      expect(mockUseRecipeCookingActions).toHaveBeenLastCalledWith({
        recipeId: 'catalog-1',
      });
      expect(mockUseRecipeSavedMetadata).toHaveBeenLastCalledWith({
        recipeId: 'catalog-1',
      });
      expect(result.current.recipeId).toBe('catalog-1');
      expect(result.current.catalogExternalId).toBe('716429');
    });

    it('opens it once, however often the screen renders', async () => {
      useRoute.mockReturnValue({ params: { catalog: HINT } });

      const { rerender } = renderHookWithApollo(() => useRecipeDetail());
      await waitFor(() =>
        expect(mockUseRecipeData).toHaveBeenLastCalledWith(
          expect.objectContaining({ recipeId: 'catalog-1' }),
        ),
      );
      rerender({});
      rerender({});

      expect(mockOpenCatalogRecipe).toHaveBeenCalledTimes(1);
    });

    it('hands the data hook the reason it could not be opened', async () => {
      mockOpenCatalogRecipe.mockResolvedValueOnce({
        opened: false,
        failure: 'Recipe not found',
      });
      useRoute.mockReturnValue({ params: { catalog: HINT } });

      renderHookWithApollo(() => useRecipeDetail());

      await waitFor(() =>
        expect(mockUseRecipeData).toHaveBeenLastCalledWith({
          recipeId: undefined,
          hint: HINT,
          openFailure: 'Recipe not found',
        }),
      );
    });
  });

  describe('after a save', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('reads a catalog recipe again twice, since nothing announces the fetch', () => {
      mockUseRecipeData.mockReturnValue({
        ...mockRecipeDataReturn,
        backendRecipe: backendRecipe({ isExternal: true }),
      });

      renderHookWithApollo(() => useRecipeDetail());
      act(() => {
        lastOnSaved()();
      });

      act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(mockRefetch).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(mockRefetch).toHaveBeenCalledTimes(1);
      act(() => {
        jest.advanceTimersByTime(7000);
      });
      expect(mockRefetch).toHaveBeenCalledTimes(2);
    });

    it('does not re-read a recipe the user wrote', () => {
      mockUseRecipeData.mockReturnValue({
        ...mockRecipeDataReturn,
        backendRecipe: backendRecipe({ isExternal: false }),
      });

      renderHookWithApollo(() => useRecipeDetail());
      act(() => {
        lastOnSaved()();
      });
      act(() => {
        jest.advanceTimersByTime(20000);
      });

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('drops the pending re-reads when the screen closes', () => {
      mockUseRecipeData.mockReturnValue({
        ...mockRecipeDataReturn,
        backendRecipe: backendRecipe({ isExternal: true }),
      });

      const { unmount } = renderHookWithApollo(() => useRecipeDetail());
      act(() => {
        lastOnSaved()();
      });
      unmount();
      jest.advanceTimersByTime(20000);

      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe('pull to refresh', () => {
    it('reads a loaded recipe again, spinning at least half a second', async () => {
      jest.useFakeTimers();
      let settle: () => void = () => {};
      mockRefetch.mockReturnValueOnce(
        new Promise<void>(resolve => {
          settle = resolve;
        }),
      );
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });
      const { result } = renderHookWithApollo(() => useRecipeDetail());

      act(() => {
        result.current.handleRefresh();
      });
      expect(result.current.refreshing).toBe(true);
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      // A read that settles at once still leaves the spinner up.
      await act(async () => {
        settle();
      });
      expect(result.current.refreshing).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(result.current.refreshing).toBe(false);
      jest.useRealTimers();
    });

    it('asks again for a catalog recipe that could not be opened', async () => {
      mockOpenCatalogRecipe.mockResolvedValueOnce({
        opened: false,
        failure: 'Recipe not found',
      });
      useRoute.mockReturnValue({ params: { catalog: HINT } });
      const { result } = renderHookWithApollo(() => useRecipeDetail());
      await waitFor(() =>
        expect(mockUseRecipeData).toHaveBeenLastCalledWith(
          expect.objectContaining({ openFailure: 'Recipe not found' }),
        ),
      );

      await act(async () => {
        result.current.handleRefresh();
      });

      await waitFor(() =>
        expect(mockUseRecipeData).toHaveBeenLastCalledWith(
          expect.objectContaining({ recipeId: 'catalog-1', openFailure: null }),
        ),
      );
      expect(mockOpenCatalogRecipe).toHaveBeenCalledTimes(2);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe('what it returns', () => {
    it('merges the shopping-list and cooking outputs', () => {
      const { result } = renderHookWithApollo(() => useRecipeDetail());

      expect(result.current).toEqual(
        expect.objectContaining({
          shoppingListSpecific: 'shopping',
          cookingSpecific: 'cooking',
        }),
      );
    });

    it('exposes the saved-metadata handlers', () => {
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

    it('reads the saved fields off the recipe’s savedDetails', () => {
      mockUseRecipeData.mockReturnValueOnce({
        ...mockRecipeDataReturn,
        backendRecipe: backendRecipe({
          savedDetails: {
            __typename: 'SavedRecipe',
            id: 'sd-1',
            folder: 'Weeknight',
            tags: ['t1'],
            notes: 'n',
            personalRating: 5,
            cookedCount: 3,
          },
        }),
      });

      const { result } = renderHookWithApollo(() => useRecipeDetail());

      expect(result.current.savedFolder).toBe('Weeknight');
      expect(result.current.savedTags).toEqual(['t1']);
      expect(result.current.savedNotes).toBe('n');
      expect(result.current.savedRating).toBe(5);
      expect(result.current.cookedCount).toBe(3);
    });

    it('reads nothing saved for an unsaved recipe', () => {
      mockUseRecipeData.mockReturnValueOnce({
        ...mockRecipeDataReturn,
        backendRecipe: backendRecipe({ savedDetails: null }),
      });

      const { result } = renderHookWithApollo(() => useRecipeDetail());

      expect(result.current.savedFolder).toBeNull();
      expect(result.current.savedTags).toEqual([]);
      expect(result.current.cookedCount).toBe(0);
    });
  });
});
