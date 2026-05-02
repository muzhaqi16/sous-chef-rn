import { renderHook, act } from '@testing-library/react-native';
import { useRecipePreload } from '../useRecipePreload';

const mockFavoriteRecipe = jest.fn();
const mockUpsertRecipe = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'FavoriteRecipe')
      return [mockFavoriteRecipe, { loading: false }];
    if (opName === 'UpsertExternalRecipe')
      return [mockUpsertRecipe, { loading: false }];
    return [jest.fn(), {}];
  }),
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
jest.mock('../../../apollo/links/tokenScheduler');

const makeSpoonacularRecipe = (id = 123) =>
  ({
    id,
    title: 'Test Recipe',
    summary: '<p>A tasty recipe</p>',
    servings: 4,
    preparationMinutes: 10,
    cookingMinutes: 20,
    image: 'https://example.com/img.jpg',
    sourceName: 'Test Source',
    sourceUrl: 'https://example.com/recipe',
    cuisines: ['Italian'],
    analyzedInstructions: [{ steps: [{ number: 1, step: 'Boil water' }] }],
    nutrition: { nutrients: [{ name: 'Calories', amount: 350 }] },
    extendedIngredients: [
      {
        name: 'pasta',
        amount: 200,
        original: '200g pasta',
        id: 1,
        aisle: 'Pasta',
        image: 'pasta.jpg',
        measures: {
          metric: { amount: 200, unitShort: 'g' },
          us: { amount: 7, unitShort: 'oz' },
        },
      },
    ],
  } as any);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRecipePreload', () => {
  it('starts with default state', () => {
    const { result } = renderHook(() => useRecipePreload());

    expect(result.current.preloading).toBe(false);
    expect(result.current.preloadedRecipe).toBeNull();
    expect(result.current.preloadError).toBeNull();
    expect(result.current.savingToFavorites).toBe(false);
  });

  it('preloadRecipe calls upsert mutation and caches result', async () => {
    mockUpsertRecipe.mockResolvedValueOnce({
      data: {
        upsertExternalRecipe: {
          recipe: {
            id: 'backend-1',
            name: 'Test Recipe',
            imageUrl: 'https://example.com/img.jpg',
          },
          created: true,
        },
      },
    });

    const onPreloadSuccess = jest.fn();
    const { result } = renderHook(() => useRecipePreload({ onPreloadSuccess }));

    let preloaded: any;
    await act(async () => {
      preloaded = await result.current.preloadRecipe(makeSpoonacularRecipe());
    });

    expect(preloaded).toEqual(
      expect.objectContaining({
        id: 'backend-1',
        name: 'Test Recipe',
        created: true,
        externalId: '123',
      }),
    );
    expect(onPreloadSuccess).toHaveBeenCalledWith(preloaded);
    expect(result.current.preloadedRecipe).toEqual(preloaded);
  });

  it('preloadRecipe returns cached result on second call', async () => {
    mockUpsertRecipe.mockResolvedValueOnce({
      data: {
        upsertExternalRecipe: {
          recipe: { id: 'backend-1', name: 'Test', imageUrl: null },
          created: false,
        },
      },
    });

    const { result } = renderHook(() => useRecipePreload());

    await act(async () => {
      await result.current.preloadRecipe(makeSpoonacularRecipe(99));
    });

    // Second call should return cached, not call mutation again
    let secondResult: any;
    await act(async () => {
      secondResult = await result.current.preloadRecipe(
        makeSpoonacularRecipe(99),
      );
    });

    expect(secondResult?.id).toBe('backend-1');
    expect(mockUpsertRecipe).toHaveBeenCalledTimes(1);
  });

  it('preloadRecipe returns null when mutation fails', async () => {
    const { executeMutation } = require('#/utils/compilerSafeWrappers');
    executeMutation.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useRecipePreload());

    let preloaded: any;
    await act(async () => {
      preloaded = await result.current.preloadRecipe(
        makeSpoonacularRecipe(200),
      );
    });

    expect(preloaded).toBeNull();
  });

  it('isPreloaded returns false for unknown externalId', () => {
    const { result } = renderHook(() => useRecipePreload());

    expect(result.current.isPreloaded('999')).toBe(false);
  });

  it('clearCache resets all state', async () => {
    mockUpsertRecipe.mockResolvedValueOnce({
      data: {
        upsertExternalRecipe: {
          recipe: { id: 'b1', name: 'R', imageUrl: null },
          created: true,
        },
      },
    });

    const { result } = renderHook(() => useRecipePreload());

    await act(async () => {
      await result.current.preloadRecipe(makeSpoonacularRecipe(50));
    });

    expect(result.current.preloadedRecipe).not.toBeNull();

    act(() => {
      result.current.clearCache();
    });

    expect(result.current.preloadedRecipe).toBeNull();
    expect(result.current.preloadError).toBeNull();
  });
});
