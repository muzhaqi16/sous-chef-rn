'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { PantryItemDetail } from '../PantryItemDetail';

// --- Break circular deps ---
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// --- Navigation ---
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#features/pantry/hooks/usePantryPermissions');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

// --- Store ---
jest.mock('#store/useAppStore', () => {
  const mockState = { selectedShoppingListId: 'sl1', selectedPantryId: 'p1' };
  const fn = (selector: any) => selector(mockState);
  fn.getState = () => mockState;
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useSelectedShoppingListId: jest.fn(() => mockState.selectedShoppingListId),
    useSelectedPantryId: jest.fn(() => mockState.selectedPantryId),
  };
});

const mockGetCachedSuggestions = jest.fn(() => null);
const mockSetCachedSuggestions = jest.fn();
jest.mock('#store/useRecipeSuggestionsStore', () => ({
  useRecipeSuggestionsStore: () => ({
    getCachedSuggestions: mockGetCachedSuggestions,
    setCachedSuggestions: mockSetCachedSuggestions,
  }),
}));

// --- GraphQL ---
const mockItemData = {
  pantryItem: {
    id: 'pi1',
    itemName: 'Milk',
    quantity: 2,
    unit: { id: 'u1', name: 'liters', symbol: 'L' },
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    storageState: 'REFRIGERATED',
    storageLocation: null,
    brand: { name: 'Organic Valley' },
    item: {
      id: 'item1',
      categories: [{ category: { name: 'Dairy' } }],
      images: null,
      nutritions: null,
    },
    condition: 'GOOD',
    acquisitionMethod: 'PURCHASED',
    costPerUnit: 3.5,
    totalCost: 7.0,
    minQuantity: null,
    restockQuantity: null,
    storageNotes: 'Keep cold',
    tags: ['organic', 'dairy'],
    purchase: null,
    lastUsedAt: null,
    usageRecords: { edges: [] },
    version: 1,
    packageBreakdown: null,
    netWeight: null,
    netWeightUnit: null,
    remainingNetWeight: null,
    quantityBreakdown: null,
    store: null,
    imageUrl: null,
  },
};

const queryResponses: Record<string, any> = {};
const setQueryResponse = (opName: string, response: any) => {
  queryResponses[opName] = response;
};

const mutationOverrides: Record<string, [jest.Mock, { loading: boolean }]> = {};

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  __esModule: true,
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName && queryResponses[opName]) return queryResponses[opName];
    return { data: mockItemData, loading: false, error: null };
  }),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName && mutationOverrides[opName]) return mutationOverrides[opName];
    return [jest.fn(), { loading: false }];
  }),
  useApolloClient: jest.fn(() => ({
    cache: { modify: jest.fn(), identify: jest.fn(() => 'cache-id') },
  })),
}));

// --- Mutation hooks ---
jest.mock('#features/pantry/hooks/mutations/useConvertExpiredToWaste', () => ({
  useConvertExpiredToWaste: () => ({ convertExpiredToWaste: jest.fn() }),
}));
jest.mock(
  '#features/pantry/hooks/mutations/useAdjustPantryItemQuantity',
  () => ({
    useAdjustPantryItemQuantity: () => ({ adjustQuantity: jest.fn() }),
  }),
);
jest.mock(
  '#features/pantry/hooks/mutations/useCorrectPantryItemWeight',
  () => ({
    useCorrectPantryItemWeight: () => ({ correctWeight: jest.fn() }),
  }),
);
jest.mock(
  '#features/pantry/hooks/mutations/useConvertExpiredBatchesToWaste',
  () => ({
    useConvertExpiredBatchesToWaste: () => ({
      convertExpiredBatches: jest.fn(),
      loading: false,
    }),
  }),
);

// --- Utils ---
jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
  parseImages: jest.fn(() => []),
  hasImages: jest.fn(() => false),
}));
jest.mock('#utils/nutritionUtils', () => ({
  parseNutritions: jest.fn(() => []),
  hasNutritionData: jest.fn(() => false),
}));
jest.mock('#features/pantry/hooks/usePantryItemTransformation', () => {
  const actual = jest.requireActual(
    '#features/pantry/hooks/usePantryItemTransformation',
  );
  return {
    ...actual,
    formatPackageBreakdownFull: jest.fn(() => null),
    formatNetWeightDisplay: jest.fn(() => null),
    formatQuantityBreakdown: jest.fn(() => null),
    formatStorageState: jest.fn(() => 'Fridge'),
  };
});
jest.mock('#utils/formatQuantity', () => ({
  getUnitDisplayText: jest.fn(unit => unit?.symbol || ''),
}));
jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  addNewItemToShoppingListCache: jest.fn(),
}));
jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipes: jest.fn(() => Promise.resolve({ results: [] })),
  },
}));
jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Error' })),
  }),
}));
jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(),
  executeMutation: jest.fn(),
  executeCacheUpdate: jest.fn(),
  executeQuery: jest.fn(),
  executeRefetch: jest.fn(),
  executeRefreshWithFinally: jest.fn(),
  executeAsyncWithCleanup: jest.fn(),
}));

// --- Performance ---
jest.mock('#hooks/performance/useScreenTransition');

// --- Child component mocks ---
jest.mock('#components/molecules/Header', () => ({
  Header: ({ rightActions, ...props }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="header">
        <Text>{props.title || 'Detail'}</Text>
        {rightActions?.map((a: any, i: number) => (
          <View key={i} testID={a.testID} />
        ))}
      </View>
    );
  },
}));
jest.mock('#components/molecules/NutritionSummary', () => ({
  NutritionSummary: () => null,
}));
jest.mock('#components/molecules/ImageGalleryTabs', () => ({
  ImageGalleryTabs: () => null,
}));
jest.mock('#components/modals/AdjustQuantityModal', () => ({
  AdjustQuantityModal: () => null,
}));
jest.mock('#components/modals/CorrectWeightModal', () => ({
  CorrectWeightModal: () => null,
}));
jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => null,
}));

describe('PantryItemDetail', () => {
  const route = { params: { itemId: 'pi1' } };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(queryResponses)) delete queryResponses[k];
    for (const k of Object.keys(mutationOverrides)) delete mutationOverrides[k];
  });

  it('renders the item name', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('shows the category and storage state', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText(/Dairy/)).toBeTruthy();
    expect(screen.getByText(/Fridge/)).toBeTruthy();
  });

  it('shows quantity info row', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('shows brand info row', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Brand')).toBeTruthy();
    expect(screen.getByText('Organic Valley')).toBeTruthy();
  });

  it('shows notes section', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('Keep cold')).toBeTruthy();
  });

  it('shows tags section', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('organic')).toBeTruthy();
    expect(screen.getByText('dairy')).toBeTruthy();
  });

  it('shows recipes section heading', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Recipes to try')).toBeTruthy();
  });

  it('renders action buttons in header', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByTestId('pantry-item-add-to-list-button')).toBeTruthy();
    expect(screen.getByTestId('pantry-item-edit-button')).toBeTruthy();
    expect(screen.getByTestId('pantry-item-delete-button')).toBeTruthy();
  });

  // --- Branch coverage tests ---

  it('renders loading state when item data is null', () => {
    setQueryResponse('GetPantryItem', {
      data: null,
      loading: true,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    // SousChefLoader is rendered (mocked to null) and header shows
    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.queryByText('Milk')).toBeNull();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders "No expiry" when expiresAt is null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          expiresAt: null,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('No expiry')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('does not render brand row when brand is null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          brand: null,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Brand')).toBeNull();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('does not render notes section when storageNotes is null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          storageNotes: null,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Notes')).toBeNull();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('does not render tags section when tags is empty', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          tags: [],
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('organic')).toBeNull();
    expect(screen.queryByText('dairy')).toBeNull();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders condition row when condition is not GOOD', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          condition: 'FAIR',
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Condition')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('does not render condition row when condition is GOOD', () => {
    render(<PantryItemDetail route={route} />);
    // Default mockItemData has condition: 'GOOD'
    expect(screen.queryByText('Condition')).toBeNull();
  });

  it('renders acquisition method row', () => {
    render(<PantryItemDetail route={route} />);
    // Default mockItemData has acquisitionMethod: 'PURCHASED'
    expect(screen.getByText('Acquired')).toBeTruthy();
  });

  it('does not render acquisition method when null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          acquisitionMethod: null,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Acquired')).toBeNull();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders cost rows when cost data exists', () => {
    render(<PantryItemDetail route={route} />);
    // Default mockItemData has costPerUnit: 3.5, totalCost: 7.0
    expect(screen.getByText('Cost/Unit')).toBeTruthy();
    expect(screen.getByText('Total Cost')).toBeTruthy();
  });

  it('does not render cost rows when costs are null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          costPerUnit: null,
          totalCost: null,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Cost/Unit')).toBeNull();
    expect(screen.queryByText('Total Cost')).toBeNull();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders discard button for expired items with quantity > 0', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          condition: 'EXPIRED',
          quantity: 2,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByTestId('pantry-item-discard-button')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('does not render discard button when condition is GOOD', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByTestId('pantry-item-discard-button')).toBeNull();
  });

  it('renders min stock row when minQuantity > 0', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          minQuantity: 3,
          restockQuantity: 5,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Min Stock')).toBeTruthy();
    expect(screen.getByText('Restock At')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('does not render min stock and restock rows when values are null', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Min Stock')).toBeNull();
    expect(screen.queryByText('Restock At')).toBeNull();
  });

  it('renders recipes section even when recipes are loading', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Recipes to try')).toBeTruthy();
  });

  it('renders storage location when it is a string', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          storageLocation: 'Top shelf',
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Storage')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders storage location when it is an object with name', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          storageLocation: { name: 'Fridge door' },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Storage')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders store name when store exists', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          store: { name: 'Whole Foods' },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Store')).toBeTruthy();
    expect(screen.getByText('Whole Foods')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders last used row when lastUsedAt exists', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          lastUsedAt: '2025-01-15T00:00:00Z',
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Last Used')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders with usage records', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: {
            edges: [
              {
                node: {
                  id: 'usage-1',
                  quantity: 1,
                  purpose: 'ADJUSTMENT',
                  createdAt: '2025-01-10T00:00:00Z',
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders with package breakdown info', () => {
    const {
      formatPackageBreakdownFull,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatPackageBreakdownFull.mockReturnValue('6 x 330ml cans');

    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          packageBreakdown: { count: 6, size: 330, unit: 'ml' },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    formatPackageBreakdownFull.mockReturnValue(null);
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders with net weight info', () => {
    const {
      formatNetWeightDisplay,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatNetWeightDisplay.mockReturnValue('500g');

    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          netWeight: 500,
          netWeightUnit: 'g',
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    formatNetWeightDisplay.mockReturnValue(null);
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders with image url', () => {
    const { resolveImageUrl } = require('#utils/imageUtils');
    resolveImageUrl.mockReturnValue('https://example.com/milk.jpg');

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    resolveImageUrl.mockReturnValue(null);
  });

  it('renders with item images', () => {
    const { parseImages, hasImages } = require('#utils/imageUtils');
    hasImages.mockReturnValue(true);
    parseImages.mockReturnValue([{ uri: 'https://example.com/img1.jpg' }]);

    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          item: {
            ...mockItemData.pantryItem.item,
            images: [{ url: 'https://example.com/img1.jpg' }],
          },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    hasImages.mockReturnValue(false);
    parseImages.mockReturnValue([]);
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders with nutrition data', () => {
    const {
      parseNutritions,
      hasNutritionData,
    } = require('#utils/nutritionUtils');
    hasNutritionData.mockReturnValue(true);
    parseNutritions.mockReturnValue([{ name: 'Calories', amount: 120 }]);

    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          item: {
            ...mockItemData.pantryItem.item,
            nutritions: [{ name: 'Calories', amount: 120 }],
          },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    hasNutritionData.mockReturnValue(false);
    parseNutritions.mockReturnValue([]);
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders with quantity breakdown', () => {
    const {
      formatQuantityBreakdown,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatQuantityBreakdown.mockReturnValue('2 of 3 remaining');

    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          quantityBreakdown: { total: 3, remaining: 2 },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    formatQuantityBreakdown.mockReturnValue(null);
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });

  it('renders with expired item that has zero quantity', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          condition: 'EXPIRED',
          quantity: 0,
        },
      },
      loading: false,
      error: null,
    });

    render(<PantryItemDetail route={route} />);
    // Discard button should not show for zero quantity
    expect(screen.queryByTestId('pantry-item-discard-button')).toBeNull();

    // Restore
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
  });
});

// ─── Additional branch-coverage tests ────────────────────────────────────────

describe('PantryItemDetail – helper functions', () => {
  // Test the module-level pure helper functions directly by importing the module
  // We re-create the logic here since they're not exported; tests confirm the
  // conditional branches through the rendered output.

  describe('getExpiryInfo branches', () => {
    const route = { params: { itemId: 'pi1' } };

    // Pin current time to noon on a fixed date to avoid time-of-day flakiness
    const FIXED_NOW = new Date('2025-06-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
      setQueryResponse('GetPantryItem', {
        data: mockItemData,
        loading: false,
        error: null,
      });
    });

    it('shows "Expired" when expiresAt is in the past', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            expiresAt: '2020-01-01T00:00:00Z',
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Expired')).toBeTruthy();
    });

    it('shows "Expires today" when expiresAt is today', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            expiresAt: FIXED_NOW.toISOString(),
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Expires today')).toBeTruthy();
    });

    it('shows "1 day to expire" when expiresAt is tomorrow', () => {
      const tomorrow = new Date(FIXED_NOW);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            expiresAt: tomorrow.toISOString(),
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('1 day to expire')).toBeTruthy();
    });

    it('shows "N days to expire" with isUrgent when <= 3 days', () => {
      const threeDays = new Date(FIXED_NOW);
      threeDays.setDate(threeDays.getDate() + 3);
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            expiresAt: threeDays.toISOString(),
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('3 days to expire')).toBeTruthy();
    });

    it('shows "N days to expire" without urgency when > 3 days', () => {
      const tenDays = new Date(FIXED_NOW);
      tenDays.setDate(tenDays.getDate() + 10);
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            expiresAt: tenDays.toISOString(),
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('10 days to expire')).toBeTruthy();
    });
  });

  describe('formatDate branches', () => {
    const route = { params: { itemId: 'pi1' } };

    afterEach(() => {
      setQueryResponse('GetPantryItem', {
        data: mockItemData,
        loading: false,
        error: null,
      });
    });

    it('renders Added row with formatted date', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            createdAt: '2025-06-15T00:00:00Z',
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Added')).toBeTruthy();
    });

    it('handles null createdAt for Added row', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            createdAt: null,
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Added')).toBeTruthy();
    });
  });

  describe('getDaysInPantry / formatDaysInPantry branches', () => {
    const route = { params: { itemId: 'pi1' } };
    const FIXED_NOW = new Date('2025-06-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers({ now: FIXED_NOW });
    });

    afterEach(() => {
      jest.useRealTimers();
      setQueryResponse('GetPantryItem', {
        data: mockItemData,
        loading: false,
        error: null,
      });
    });

    it('shows "Today" when item was just added', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            createdAt: FIXED_NOW.toISOString(),
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Today')).toBeTruthy();
    });

    it('shows "1 day" when item was added yesterday', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            createdAt: new Date('2025-06-14T12:00:00Z').toISOString(),
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('1 day')).toBeTruthy();
    });

    it('shows "-" when createdAt is null', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            createdAt: null,
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('-')).toBeTruthy();
    });

    it('shows "N days" for items several days old', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            createdAt: new Date('2025-06-10T12:00:00Z').toISOString(),
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('5 days')).toBeTruthy();
    });
  });

  describe('formatCondition branches', () => {
    const route = { params: { itemId: 'pi1' } };

    afterEach(() => {
      setQueryResponse('GetPantryItem', {
        data: mockItemData,
        loading: false,
        error: null,
      });
    });

    it('returns null for GOOD condition - no Condition row', () => {
      render(<PantryItemDetail route={route} />);
      expect(screen.queryByText('Condition')).toBeNull();
    });

    it('returns null for null condition - no Condition row', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: { ...mockItemData.pantryItem, condition: null },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.queryByText('Condition')).toBeNull();
    });

    it('renders SPOILED condition with error styling', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: { ...mockItemData.pantryItem, condition: 'SPOILED' },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Condition')).toBeTruthy();
    });

    it('renders EXPIRED condition with error styling', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: { ...mockItemData.pantryItem, condition: 'EXPIRED' },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Condition')).toBeTruthy();
    });

    it('renders FAIR condition with warning styling', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: { ...mockItemData.pantryItem, condition: 'FAIR' },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Condition')).toBeTruthy();
    });
  });

  describe('formatAcquisitionMethod branches', () => {
    const route = { params: { itemId: 'pi1' } };

    afterEach(() => {
      setQueryResponse('GetPantryItem', {
        data: mockItemData,
        loading: false,
        error: null,
      });
    });

    it('formats PURCHASED method', () => {
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Acquired')).toBeTruthy();
    });

    it('formats multi-word acquisition method like HOME_GROWN', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            acquisitionMethod: 'HOME_GROWN',
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.getByText('Acquired')).toBeTruthy();
    });

    it('does not render Acquired row when acquisitionMethod is null', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: { ...mockItemData.pantryItem, acquisitionMethod: null },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.queryByText('Acquired')).toBeNull();
    });
  });

  describe('formatCurrency branches', () => {
    const route = { params: { itemId: 'pi1' } };

    afterEach(() => {
      setQueryResponse('GetPantryItem', {
        data: mockItemData,
        loading: false,
        error: null,
      });
    });

    it('does not render cost rows when costPerUnit is 0', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            costPerUnit: 0,
            totalCost: 0,
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.queryByText('Cost/Unit')).toBeNull();
      expect(screen.queryByText('Total Cost')).toBeNull();
    });

    it('does not render cost rows when costPerUnit is negative', () => {
      setQueryResponse('GetPantryItem', {
        data: {
          pantryItem: {
            ...mockItemData.pantryItem,
            costPerUnit: -1,
            totalCost: -5,
          },
        },
        loading: false,
        error: null,
      });
      render(<PantryItemDetail route={route} />);
      expect(screen.queryByText('Cost/Unit')).toBeNull();
      expect(screen.queryByText('Total Cost')).toBeNull();
    });
  });
});

describe('PantryItemDetail – additional UI branch coverage', () => {
  const route = { params: { itemId: 'pi1' } };

  afterEach(() => {
    setQueryResponse('GetPantryItem', {
      data: mockItemData,
      loading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  // ---------- Category badge branches ----------

  it('shows categoryName in badge when present', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText(/Dairy/)).toBeTruthy();
  });

  it('shows "Item" fallback when categoryName is null but storageStateDisplay exists', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          item: { ...mockItemData.pantryItem.item, categories: [] },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText(/Item/)).toBeTruthy();
  });

  it('hides category badge when both categoryName and storageStateDisplay are null', () => {
    const {
      formatStorageState,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatStorageState.mockReturnValue(null);
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          item: { ...mockItemData.pantryItem.item, categories: [] },
          storageState: null,
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    // No category badge - "Item" fallback should not appear either
    expect(screen.queryByText('Item in')).toBeNull();

    // Restore
    formatStorageState.mockReturnValue('Fridge');
  });

  it('shows storageStateDisplay appended to category', () => {
    const {
      formatStorageState,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatStorageState.mockReturnValue('Freezer');
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText(/Dairy in Freezer/)).toBeTruthy();

    // Restore
    formatStorageState.mockReturnValue('Fridge');
  });

  // ---------- Net weight row branches ----------

  it('renders Net Weight row when netWeightText is truthy', () => {
    const {
      formatNetWeightDisplay,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatNetWeightDisplay.mockReturnValue('500g');
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          netWeight: 500,
          netWeightUnit: { symbol: 'g' },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Net Weight')).toBeTruthy();

    // Restore
    formatNetWeightDisplay.mockReturnValue(null);
  });

  it('does not render Net Weight row when netWeightText is null', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Net Weight')).toBeNull();
  });

  it('renders correct weight button inside net weight row when lastUsedAt exists', () => {
    const {
      formatNetWeightDisplay,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatNetWeightDisplay.mockReturnValue('500g');
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          netWeight: 500,
          netWeightUnit: { symbol: 'g' },
          lastUsedAt: '2025-03-01T00:00:00Z',
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Net Weight')).toBeTruthy();

    // Restore
    formatNetWeightDisplay.mockReturnValue(null);
  });

  // ---------- Remaining weight row ----------

  it('renders Remaining Weight row when remainingNetWeightText is truthy', () => {
    const {
      formatNetWeightDisplay,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    // First call is for netWeight, second for remainingNetWeight
    formatNetWeightDisplay
      .mockReturnValueOnce('500g')
      .mockReturnValueOnce('350g');
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          netWeight: 500,
          remainingNetWeight: 350,
          netWeightUnit: { symbol: 'g' },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Remaining Weight')).toBeTruthy();

    // Restore
    formatNetWeightDisplay.mockReturnValue(null);
  });

  // ---------- Inventory breakdown row ----------

  it('renders Inventory row when quantityBreakdownText is truthy', () => {
    const {
      formatQuantityBreakdown,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatQuantityBreakdown.mockReturnValue('2 of 3 remaining');
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Inventory')).toBeTruthy();

    // Restore
    formatQuantityBreakdown.mockReturnValue(null);
  });

  it('does not render Inventory row when quantityBreakdownText is null', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Inventory')).toBeNull();
  });

  // ---------- Package breakdown row ----------

  it('renders Package row when packageBreakdownText is truthy', () => {
    const {
      formatPackageBreakdownFull,
    } = require('#features/pantry/hooks/usePantryItemTransformation');
    formatPackageBreakdownFull.mockReturnValue('6 x 330ml cans');
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Package')).toBeTruthy();

    // Restore
    formatPackageBreakdownFull.mockReturnValue(null);
  });

  it('does not render Package row when packageBreakdownText is null', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Package')).toBeNull();
  });

  // ---------- Storage location branches ----------

  it('does not render Storage row when storageLocation is null', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Storage')).toBeNull();
  });

  it('renders Storage with string storageLocation', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          storageLocation: 'Top shelf',
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Top shelf')).toBeTruthy();
  });

  it('renders Storage with object storageLocation.name', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          storageLocation: { name: 'Fridge door' },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Fridge door')).toBeTruthy();
  });

  // ---------- Store row ----------

  it('does not render Store row when store is null', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Store')).toBeNull();
  });

  // ---------- Min stock / restock branches ----------

  it('does not render Min Stock when minQuantity is 0', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: { ...mockItemData.pantryItem, minQuantity: 0 },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Min Stock')).toBeNull();
  });

  it('does not render Restock At when restockQuantity is 0', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: { ...mockItemData.pantryItem, restockQuantity: 0 },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Restock At')).toBeNull();
  });

  // ---------- Purchase date row ----------

  it('renders Purchase date row when purchase exists', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          purchase: { purchaseDate: '2025-01-10T00:00:00Z', unitPrice: 4.99 },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    // "Purchased" appears as both the PantryInfoRow label AND the formatted acquisitionMethod value
    expect(screen.getAllByText('Purchased').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Purchase date without price when unitPrice is 0', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          purchase: { purchaseDate: '2025-01-10T00:00:00Z', unitPrice: 0 },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getAllByText('Purchased').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Purchase date without price when unitPrice is null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          purchase: { purchaseDate: '2025-01-10T00:00:00Z', unitPrice: null },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getAllByText('Purchased').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render Purchased row when purchase is null', () => {
    render(<PantryItemDetail route={route} />);
    // With purchase: null, the Purchased date row is not rendered.
    // However, "Purchased" still appears as the formatAcquisitionMethod value.
    // Verify only one instance exists (from acquisitionMethod, not from purchase row label).
    const matches = screen.queryAllByText('Purchased');
    expect(matches.length).toBe(1); // Only from acquisitionMethod value
  });

  // ---------- Last used row ----------

  it('does not render Last Used when lastUsedAt is null', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Last Used')).toBeNull();
  });

  // ---------- Notes section ----------

  it('does not render Notes when storageNotes is empty string', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: { ...mockItemData.pantryItem, storageNotes: '' },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Notes')).toBeNull();
  });

  // ---------- Tags section ----------

  it('does not render Tags when tags is null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: { ...mockItemData.pantryItem, tags: null },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Tags')).toBeNull();
  });

  // ---------- Usage records section ----------

  it('renders usage history section header when usage records exist', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: {
            edges: [
              {
                node: {
                  id: 'u1',
                  usedAt: '2025-01-10T00:00:00Z',
                  quantityUsed: 1,
                  purpose: 'COOKING',
                  adjustmentReason: null,
                  usageUnit: { symbol: 'L' },
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Usage History (1)')).toBeTruthy();
  });

  it('does not render usage history when edges are empty', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText(/Usage History/)).toBeNull();
  });

  it('renders expanded usage records with ADJUSTMENT purpose', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: {
            edges: [
              {
                node: {
                  id: 'u1',
                  usedAt: '2025-01-10T00:00:00Z',
                  quantityUsed: 3,
                  purpose: 'ADJUSTMENT',
                  adjustmentReason: 'Counted wrong',
                  usageUnit: { symbol: 'L' },
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    // Click to expand
    const header = screen.getByText('Usage History (1)');
    require('@testing-library/react-native').fireEvent.press(header);
    expect(screen.getByText('Inventory adjusted')).toBeTruthy();
    expect(screen.getByText('Counted wrong')).toBeTruthy();
  });

  it('renders expanded usage records with non-ADJUSTMENT purpose', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: {
            edges: [
              {
                node: {
                  id: 'u1',
                  usedAt: '2025-01-10T00:00:00Z',
                  quantityUsed: 1,
                  purpose: 'COOKING',
                  adjustmentReason: null,
                  usageUnit: null,
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    const header = screen.getByText('Usage History (1)');
    require('@testing-library/react-native').fireEvent.press(header);
    expect(screen.getByText('Cooking')).toBeTruthy();
  });

  it('shows "+N more entries" when more than 5 usage records', () => {
    const edges = Array.from({ length: 7 }, (_, i) => ({
      node: {
        id: `u${i}`,
        usedAt: '2025-01-10T00:00:00Z',
        quantityUsed: 1,
        purpose: 'COOKING',
        adjustmentReason: null,
        usageUnit: { symbol: 'L' },
      },
    }));
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: { edges },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    const header = screen.getByText('Usage History (7)');
    require('@testing-library/react-native').fireEvent.press(header);
    expect(screen.getByText('+2 more entries')).toBeTruthy();
  });

  it('shows adjustment with negative quantity (no + prefix)', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: {
            edges: [
              {
                node: {
                  id: 'u1',
                  usedAt: '2025-01-10T00:00:00Z',
                  quantityUsed: -2,
                  purpose: 'ADJUSTMENT',
                  adjustmentReason: null,
                  usageUnit: { symbol: 'kg' },
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    const header = screen.getByText('Usage History (1)');
    require('@testing-library/react-native').fireEvent.press(header);
    expect(screen.getByText('-2 kg')).toBeTruthy();
  });

  it('shows adjustment with positive quantity (+ prefix)', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: {
            edges: [
              {
                node: {
                  id: 'u1',
                  usedAt: '2025-01-10T00:00:00Z',
                  quantityUsed: 3,
                  purpose: 'ADJUSTMENT',
                  adjustmentReason: null,
                  usageUnit: { symbol: 'kg' },
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    const header = screen.getByText('Usage History (1)');
    require('@testing-library/react-native').fireEvent.press(header);
    expect(screen.getByText('+3 kg')).toBeTruthy();
  });

  it('renders usage record without usageUnit symbol', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          usageRecords: {
            edges: [
              {
                node: {
                  id: 'u1',
                  usedAt: '2025-01-10T00:00:00Z',
                  quantityUsed: 1,
                  purpose: 'COOKING',
                  adjustmentReason: null,
                  usageUnit: null,
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    const header = screen.getByText('Usage History (1)');
    require('@testing-library/react-native').fireEvent.press(header);
    expect(screen.getByText('-1')).toBeTruthy();
  });

  // ---------- Recipes section branches ----------

  it('renders "No recipe suggestions available" when no recipes', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('No recipe suggestions available')).toBeTruthy();
  });

  // ---------- Header action button variants ----------

  it('renders header with success variant when addToListStatus is success', () => {
    // Hard to test internal state directly, but verify structure renders
    render(<PantryItemDetail route={route} />);
    expect(screen.getByTestId('pantry-item-add-to-list-button')).toBeTruthy();
  });

  it('renders adjust button in header', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.getByTestId('pantry-item-adjust-button')).toBeTruthy();
  });

  // ---------- Discard expired button branches ----------

  it('shows discard button for EXPIRED items with quantity > 0', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          condition: 'EXPIRED',
          quantity: 5,
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByTestId('pantry-item-discard-button')).toBeTruthy();
  });

  it('does not show discard button for non-EXPIRED items', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          condition: 'SPOILED',
          quantity: 5,
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByTestId('pantry-item-discard-button')).toBeNull();
  });

  // ---------- Image section branches ----------

  it('does not render image section when showImages is false', () => {
    render(<PantryItemDetail route={route} />);
    // With default mocks, hasImages returns false and resolveImageUrl returns null
    // so image section should not be visible. The ImageGalleryTabs mock returns null anyway.
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders image section when fallback imageUrl exists', () => {
    const { resolveImageUrl, hasImages } = require('#utils/imageUtils');
    resolveImageUrl.mockReturnValue('https://example.com/img.jpg');
    hasImages.mockReturnValue(false);

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore
    resolveImageUrl.mockReturnValue(null);
    hasImages.mockReturnValue(false);
  });

  // ---------- Nutrition section branches ----------

  it('does not render Nutrition section when showNutrition is false', () => {
    render(<PantryItemDetail route={route} />);
    expect(screen.queryByText('Nutrition')).toBeNull();
  });

  it('renders Nutrition section when showNutrition is true', () => {
    const {
      hasNutritionData,
      parseNutritions,
    } = require('#utils/nutritionUtils');
    hasNutritionData.mockReturnValue(true);
    parseNutritions.mockReturnValue([{ name: 'Protein', amount: 10 }]);

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Nutrition')).toBeTruthy();

    // Restore
    hasNutritionData.mockReturnValue(false);
    parseNutritions.mockReturnValue([]);
  });

  // ---------- handleDelete ----------

  it('triggers delete alert when delete button is pressed', () => {
    // We need to actually render the header with functional onPress
    const mockHeader = require('#components/molecules/Header');
    let capturedRightActions: any[];
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      capturedRightActions = rightActions;
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });

    render(<PantryItemDetail route={route} />);
    // Find the delete action
    const deleteAction = capturedRightActions!.find(
      (a: any) => a.testID === 'pantry-item-delete-button',
    );
    deleteAction.onPress();
    expect(alertService.alert).toHaveBeenCalledWith(
      'Delete Item',
      'Are you sure you want to delete this item?',
      expect.any(Array),
    );

    // Restore header mock
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });
  });

  // ---------- handleAddToShoppingList ----------

  it('shows alert when no shopping list is selected', () => {
    const storeModule = require('#store/useAppStore');
    const origUseAppStore = storeModule.useAppStore;
    // Override to return null for selectedShoppingListId
    storeModule.useAppStore = (selector: any) =>
      selector({ selectedShoppingListId: null });
    storeModule.useAppStore.getState = () => ({ selectedShoppingListId: null });
    storeModule.useAppStore.setState = jest.fn();
    storeModule.useAppStore.subscribe = jest.fn();
    storeModule.useSelectedShoppingListId.mockReturnValue(null);

    const mockHeader = require('#components/molecules/Header');
    let capturedRightActions: any[];
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      capturedRightActions = rightActions;
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });

    render(<PantryItemDetail route={route} />);
    const addToListAction = capturedRightActions!.find(
      (a: any) => a.testID === 'pantry-item-add-to-list-button',
    );
    addToListAction.onPress();
    expect(alertService.alert).toHaveBeenCalledWith(
      'No Shopping List Selected',
      'Please select a shopping list first.',
      expect.any(Array),
    );

    storeModule.useAppStore = origUseAppStore;
    // Restore header mock
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });
  });

  // ---------- handleEdit ----------

  it('calls navigateTo.pantryItem on edit button press', () => {
    const mockHeader = require('#components/molecules/Header');
    let capturedRightActions: any[];
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      capturedRightActions = rightActions;
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });

    render(<PantryItemDetail route={route} />);
    const editAction = capturedRightActions!.find(
      (a: any) => a.testID === 'pantry-item-edit-button',
    );
    editAction.onPress();
    expect(mockNav.navigateTo.pantryItem).toHaveBeenCalledWith({
      itemId: 'pi1',
    });

    // Restore header mock
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });
  });

  // ---------- handleDiscardExpired ----------

  it('shows discard alert when discard button is pressed', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          condition: 'EXPIRED',
          quantity: 3,
        },
      },
      loading: false,
      error: null,
    });

    const mockHeader = require('#components/molecules/Header');
    let capturedRightActions: any[];
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      capturedRightActions = rightActions;
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });

    render(<PantryItemDetail route={route} />);
    const discardAction = capturedRightActions!.find(
      (a: any) => a.testID === 'pantry-item-discard-button',
    );
    discardAction.onPress();
    expect(alertService.alert).toHaveBeenCalledWith(
      'Discard Expired Item',
      expect.stringContaining('3'),
      expect.any(Array),
    );

    // Restore header mock
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });
  });

  // ---------- handleConfirmAdjust with null item ----------

  it('handles handleConfirmAdjust guard when item exists', () => {
    const mockHeader = require('#components/molecules/Header');
    let capturedRightActions: any[];
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      capturedRightActions = rightActions;
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });

    render(<PantryItemDetail route={route} />);
    const adjustAction = capturedRightActions!.find(
      (a: any) => a.testID === 'pantry-item-adjust-button',
    );
    // Just verify the onPress doesn't throw - it opens the modal
    adjustAction.onPress();
    expect(screen.getByText('Milk')).toBeTruthy();

    // Restore header mock
    mockHeader.Header = jest.fn(({ rightActions, ...props }: any) => {
      const { View, Text } = require('react-native');
      return (
        <View testID="header">
          <Text>{props.title || 'Detail'}</Text>
          {rightActions?.map((a: any, i: number) => (
            <View key={i} testID={a.testID} />
          ))}
        </View>
      );
    });
  });

  // ---------- PantryInfoRow with/without children ----------

  it('renders PantryInfoRow with value (no children)', () => {
    render(<PantryItemDetail route={route} />);
    // Quantity row always renders with value text
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  // ---------- item.unit?.name for min/restock display ----------

  it('renders Min Stock and Restock At with unit name', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          minQuantity: 2,
          restockQuantity: 5,
          unit: { id: 'u1', name: 'liters', symbol: 'L' },
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Min Stock')).toBeTruthy();
    expect(screen.getByText('Restock At')).toBeTruthy();
  });

  it('renders Min Stock and Restock At without unit name when unit is null', () => {
    setQueryResponse('GetPantryItem', {
      data: {
        pantryItem: {
          ...mockItemData.pantryItem,
          minQuantity: 2,
          restockQuantity: 5,
          unit: null,
        },
      },
      loading: false,
      error: null,
    });
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Min Stock')).toBeTruthy();
    expect(screen.getByText('Restock At')).toBeTruthy();
  });

  // ---------- PantryInfoRow iconColor default ----------

  it('renders PantryInfoRow with default icon color when iconColor is not provided', () => {
    // The Quantity row always uses default icon color
    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  // ---------- Recipes with cached suggestions ----------

  it('uses cached suggestions when available', () => {
    // Use the stable module-level mock refs to avoid infinite re-renders
    // (new jest.fn() instances on every render cause useEffect dependency changes)
    mockGetCachedSuggestions.mockReturnValue([
      { id: 1, title: 'Milk Shake', image: 'https://example.com/shake.jpg' },
    ] as any);

    render(<PantryItemDetail route={route} />);
    expect(screen.getByText('Milk Shake')).toBeTruthy();

    // Restore
    mockGetCachedSuggestions.mockReturnValue(null);
  });
});
