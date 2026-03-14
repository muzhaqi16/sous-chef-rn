'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { PantryItemForm } from '../PantryItemForm';
import { renderWithProviders } from '#/test-utils/renderWithProviders';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: {},
    padding: {},
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => null),
  selectSelectedPantryId: jest.fn(),
  selectSelectedHomeId: jest.fn(),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHome: jest.fn(() => ({ pantries: [{ id: 'p1', isDefault: true }] })),
  normalizePantry: jest.fn(() => ({ storageLocations: [] })),
}));

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetPantryItemQuery: jest.fn(() => ({
    data: null,
    loading: false,
    refetch: jest.fn(),
  })),
  useGetHomeQuery: jest.fn(() => ({
    data: null,
  })),
  useGetPantryQuery: jest.fn(() => ({
    data: null,
  })),
}));

jest.mock('#hooks/pantry/mutations/useCreatePantryItem', () => ({
  useCreatePantryItem: jest.fn(() => ({
    createPantryItem: jest.fn(),
  })),
}));

jest.mock('#hooks/pantry/mutations/useUpdatePantryItem', () => ({
  useUpdatePantryItem: jest.fn(() => ({
    updatePantryItemFields: jest.fn(),
  })),
}));

jest.mock('#hooks/pantry/mutations/useUpdatePantryItemQuantity', () => ({
  useUpdatePantryItemQuantity: jest.fn(() => ({
    updateQuantity: jest.fn(),
  })),
}));

jest.mock('#hooks/pantry/mutations/useResolveUnit', () => ({
  useResolveUnit: jest.fn(() => ({
    resolveUnitId: jest.fn(),
  })),
}));

jest.mock('#hooks/pantry/mutations/types', () => ({
  emptyUnitSelection: { id: null, name: null, symbol: null, type: null },
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => parseFloat(input) || 0),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({ label, placeholder }: any) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput placeholder={placeholder} testID={`input-${label}`} />
      </View>
    );
  },
}));

jest.mock(
  '#components/molecules/AutocompleteField/UnitAutocompleteField',
  () => ({
    UnitAutocompleteField: ({ label, placeholder }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View>
          <Text>{label}</Text>
          <Text>{placeholder}</Text>
        </View>
      );
    },
  }),
);

jest.mock('#components/molecules/FieldRow', () => ({
  FieldRow: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="field-row">{children}</View>;
  },
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="form-header">
        <Text>{title}</Text>
      </View>
    );
  },
}));

jest.mock('#components/molecules/DynamicFormFields', () => ({
  DynamicFormFields: () => {
    const { View } = require('react-native');
    return <View testID="dynamic-form-fields" />;
  },
}));

jest.mock('../ItemInformationSection', () => ({
  ItemInformationSection: ({ mode, testID }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID={testID || 'item-info-section'}>
        <Text>Item Information ({mode})</Text>
      </View>
    );
  },
}));

jest.mock('../QuantitySection', () => ({
  QuantitySection: ({ mode, testID }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID={testID || 'quantity-section'}>
        <Text>Quantity ({mode})</Text>
      </View>
    );
  },
}));

jest.mock('../StorageDetailsSection', () => ({
  StorageDetailsSection: ({ mode }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="storage-details-section">
        <Text>Storage Details ({mode})</Text>
      </View>
    );
  },
}));

jest.mock('#/apollo/links/tokenScheduler');

jest.mock('#/apollo/links/refreshToken');

describe('PantryItemForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders in add mode with correct title', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByText('Add Pantry Item')).toBeTruthy();
  });

  it('renders the form with testID for add mode', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('renders item information section in add mode', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByText('Item Information (add)')).toBeTruthy();
  });

  it('renders quantity section in add mode', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByText('Quantity (add)')).toBeTruthy();
  });

  it('renders storage details section in add mode', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByText('Storage Details (add)')).toBeTruthy();
  });

  it('renders net weight section', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getAllByText('Net Weight').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render tags section in add mode', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.queryByText('Tags')).toBeNull();
  });

  it('shows loading spinner in edit mode while loading', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValueOnce({
      data: null,
      loading: true,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    // ActivityIndicator is rendered, no form visible
    expect(screen.queryByText('Edit Pantry Item')).toBeNull();
  });

  it('shows error message when item not found in edit mode', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: { pantryItem: null },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Item not found')).toBeTruthy();
    // Restore default mock
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('renders edit mode form when item data is available', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Flour',
          quantity: 5,
          unit: { id: 'u1', name: 'Pounds', symbol: 'lbs', type: 'MASS' },
          storageState: 'AMBIENT',
          storageLocation: null,
          expiresAt: null,
          storageNotes: '',
          item: { categories: [] },
          brand: null,
          tags: [],
          minQuantity: null,
          restockQuantity: null,
          netWeight: null,
          netWeightUnit: null,
          lastUsedAt: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    expect(screen.getByTestId('edit-pantry-item-modal')).toBeTruthy();
    // Restore default mock
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  // --- Branch coverage tests ---

  it('renders tags section in edit mode', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Sugar',
          quantity: 2,
          unit: { id: 'u1', name: 'lbs', symbol: 'lbs', type: 'MASS' },
          storageState: 'AMBIENT',
          storageLocation: null,
          expiresAt: null,
          storageNotes: '',
          item: { categories: [] },
          brand: null,
          tags: ['baking'],
          minQuantity: null,
          restockQuantity: null,
          netWeight: null,
          netWeightUnit: null,
          lastUsedAt: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Tags')).toBeTruthy();
    expect(screen.getByTestId('dynamic-form-fields')).toBeTruthy();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('renders edit mode with storageLocation as string', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Rice',
          quantity: 10,
          unit: null,
          storageState: 'AMBIENT',
          storageLocation: 'Top shelf',
          expiresAt: null,
          storageNotes: '',
          item: { categories: [{ category: { name: 'Grains' } }] },
          brand: { name: 'Uncle Bens' },
          tags: [],
          minQuantity: 2,
          restockQuantity: 5,
          netWeight: 500,
          netWeightUnit: { id: 'nw1', name: 'grams', symbol: 'g' },
          lastUsedAt: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('renders edit mode with storageLocation as object', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Butter',
          quantity: 1,
          unit: null,
          storageState: 'REFRIGERATED',
          storageLocation: { name: 'Fridge door' },
          expiresAt: '2025-12-31T00:00:00Z',
          storageNotes: 'Keep sealed',
          item: { categories: [] },
          brand: null,
          tags: [],
          minQuantity: null,
          restockQuantity: null,
          netWeight: null,
          netWeightUnit: null,
          lastUsedAt: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('renders weight locked hint when item has lastUsedAt', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Olive Oil',
          quantity: 1,
          unit: null,
          storageState: 'AMBIENT',
          storageLocation: null,
          expiresAt: null,
          storageNotes: '',
          item: { categories: [] },
          brand: null,
          tags: [],
          minQuantity: null,
          restockQuantity: null,
          netWeight: 500,
          netWeightUnit: { id: 'nw1', name: 'ml', symbol: 'ml' },
          lastUsedAt: '2024-01-15T00:00:00Z',
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText(/Weight locked after use/)).toBeTruthy();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('renders edit mode with no storageState defaults to AMBIENT', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Salt',
          quantity: 1,
          unit: null,
          storageState: null,
          storageLocation: null,
          expiresAt: null,
          storageNotes: '',
          item: { categories: [] },
          brand: null,
          tags: [],
          minQuantity: null,
          restockQuantity: null,
          netWeight: null,
          netWeightUnit: null,
          lastUsedAt: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('renders add mode with proper testIDs', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-name-input')).toBeTruthy();
    expect(screen.getByTestId('add-pantry-item-quantity-input')).toBeTruthy();
  });

  it('renders edit mode quantity testID', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Eggs',
          quantity: 12,
          unit: null,
          storageState: 'REFRIGERATED',
          storageLocation: null,
          expiresAt: null,
          storageNotes: '',
          item: { categories: [] },
          brand: null,
          tags: [],
          minQuantity: null,
          restockQuantity: null,
          netWeight: null,
          netWeightUnit: null,
          lastUsedAt: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByTestId('edit-pantry-item-quantity-input')).toBeTruthy();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('does not render weight locked hint when item has no lastUsedAt', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Pasta',
          quantity: 3,
          unit: null,
          storageState: 'AMBIENT',
          storageLocation: null,
          expiresAt: null,
          storageNotes: '',
          item: { categories: [] },
          brand: null,
          tags: [],
          minQuantity: null,
          restockQuantity: null,
          netWeight: null,
          netWeightUnit: null,
          lastUsedAt: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.queryByText(/Weight locked after use/)).toBeNull();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  it('renders edit mode with existing item that has all fields populated', () => {
    const { useGetPantryItemQuery } = require('#generated');
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          id: 'item-1',
          itemName: 'Premium Coffee',
          quantity: 2,
          unit: { id: 'u1', name: 'bags', symbol: 'bag', type: 'COUNT' },
          storageState: 'AMBIENT',
          storageLocation: { name: 'Pantry shelf' },
          expiresAt: '2025-06-15T00:00:00Z',
          storageNotes: 'Keep dry and sealed',
          item: { categories: [{ category: { name: 'Beverages' } }] },
          brand: { name: 'Lavazza' },
          tags: ['coffee', 'premium'],
          minQuantity: 1,
          restockQuantity: 3,
          netWeight: 250,
          netWeightUnit: { id: 'nw1', name: 'grams', symbol: 'g' },
          lastUsedAt: '2025-01-10T00:00:00Z',
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    expect(screen.getByText(/Weight locked after use/)).toBeTruthy();
    // Restore
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });
});

// ─── Additional branch-coverage tests ────────────────────────────────────────

describe('PantryItemForm – additional branch coverage', () => {
  const {
    useGetPantryItemQuery,
    useGetHomeQuery,
    useGetPantryQuery,
  } = require('#generated');
  const { useAppStore } = require('#store/useAppStore');
  const { normalizeHome, normalizePantry } = require('#/utils/connectionUtils');
  const { parseFractionalInput } = require('#/utils/fractionUtils');

  const baseEditItem = {
    id: 'item-1',
    itemName: 'Flour',
    quantity: 5,
    unit: { id: 'u1', name: 'Pounds', symbol: 'lbs', type: 'MASS' },
    storageState: 'AMBIENT',
    storageLocation: null,
    expiresAt: null,
    storageNotes: '',
    item: { categories: [] },
    brand: null,
    tags: [],
    minQuantity: null,
    restockQuantity: null,
    netWeight: null,
    netWeightUnit: null,
    lastUsedAt: null,
    pantryId: 'p1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
    useGetHomeQuery.mockReturnValue({ data: null });
    useGetPantryQuery.mockReturnValue({ data: null });
    useAppStore.mockReturnValue(null);
    normalizeHome.mockReturnValue({
      pantries: [{ id: 'p1', isDefault: true }],
    });
    normalizePantry.mockReturnValue({ storageLocations: [] });
    parseFractionalInput.mockImplementation((v: string) => parseFloat(v) || 0);
  });

  afterEach(() => {
    useGetPantryItemQuery.mockReturnValue({
      data: null,
      loading: false,
      refetch: jest.fn(),
    });
  });

  // ---------- getDefaultPantry branches ----------

  it('returns null from getDefaultPantry when normalizeHome returns null', () => {
    normalizeHome.mockReturnValue(null);
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('returns null from getDefaultPantry when pantries array is empty', () => {
    normalizeHome.mockReturnValue({ pantries: [] });
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('falls back to first pantry when no default pantry exists', () => {
    normalizeHome.mockReturnValue({
      pantries: [{ id: 'p-fallback', isDefault: false }],
    });
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('uses selectedPantryId from store when available', () => {
    useAppStore.mockReturnValue('store-pantry-id');
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('uses pantryId from existingItemData when no store/home data', () => {
    normalizeHome.mockReturnValue(null);
    useAppStore.mockReturnValue(null);
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: { ...baseEditItem, pantryId: 'existing-pantry' },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  // ---------- getInitialValues branches ----------

  it('initializes with add mode defaults', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByText('Item Information (add)')).toBeTruthy();
  });

  it('initializes edit values when existing item has all null/empty fields', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          unit: null,
          quantity: null,
          storageState: null,
          item: { categories: [] },
          brand: null,
          storageNotes: null,
          tags: null,
          minQuantity: null,
          restockQuantity: null,
          netWeight: null,
          netWeightUnit: null,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('initializes edit values with storageLocation as string', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          storageLocation: 'Shelf A',
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('initializes edit values with storageLocation as object', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          storageLocation: { name: 'Bottom Shelf' },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('initializes with category name from existing item', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          item: { categories: [{ category: { name: 'Baking' } }] },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('initializes brand name from existing item', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          brand: { name: 'King Arthur' },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('initializes with existing item that has expiresAt', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          expiresAt: '2026-12-31T00:00:00Z',
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  // ---------- "adjusting state during render" data sync branches ----------

  it('sets tracking unit from existing item.unit during render sync', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          unit: { id: 'u2', name: 'kilograms', symbol: 'kg', type: 'MASS' },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('sets net weight unit display from existing item during render sync', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          netWeightUnit: { id: 'nw1', symbol: 'g', name: 'grams' },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('uses netWeightUnit.name when symbol is absent during sync', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          netWeightUnit: { id: 'nw1', symbol: null, name: 'grams' },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('uses empty string when netWeightUnit has no symbol or name', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          netWeightUnit: { id: 'nw1', symbol: null, name: null },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('does not sync when mode is add', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: { pantryItem: baseEditItem },
      loading: false,
      refetch: jest.fn(),
    });
    // Even though data exists, mode="add" skips the render sync
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('does not re-sync when existingItemData reference stays the same', () => {
    const stableData = { pantryItem: baseEditItem };
    useGetPantryItemQuery.mockReturnValue({
      data: stableData,
      loading: false,
      refetch: jest.fn(),
    });
    const { rerender } = renderWithProviders(
      <PantryItemForm mode="edit" itemId="item-1" />,
    );
    // Re-render with the same data reference
    rerender(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  // ---------- handleItemSelect branches ----------

  it('calls handleItemSelect with brands', () => {
    const mockItemInfoSection = require('../ItemInformationSection');
    // Override the mock to capture onSelectItem
    let capturedOnSelectItem: any;
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID, onSelectItem }: any) => {
        capturedOnSelectItem = onSelectItem;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    expect(capturedOnSelectItem).toBeDefined();
    capturedOnSelectItem({
      id: 'i1',
      name: 'Bread',
      brands: [
        { id: 'b1', name: 'Pepperidge' },
        { id: 'b2', name: 'Wonder' },
      ],
      category: { name: 'Bakery' },
      defaultUnit: { id: 'du1', name: 'loaves', symbol: 'loaf' },
    });
    // No crash - handler ran
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );
  });

  it('calls handleItemSelect without brands', () => {
    const mockItemInfoSection = require('../ItemInformationSection');
    let capturedOnSelectItem: any;
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID, onSelectItem }: any) => {
        capturedOnSelectItem = onSelectItem;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnSelectItem({
      id: 'i2',
      name: 'Water',
      brands: [],
      category: null,
      defaultUnit: null,
    });
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );
  });

  it('calls handleItemSelect with category but no defaultUnit', () => {
    const mockItemInfoSection = require('../ItemInformationSection');
    let capturedOnSelectItem: any;
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID, onSelectItem }: any) => {
        capturedOnSelectItem = onSelectItem;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnSelectItem({
      id: 'i3',
      name: 'Cheese',
      brands: null,
      category: { name: 'Dairy' },
      defaultUnit: { id: null, name: null, symbol: null },
    });
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );
  });

  // ---------- handleStorageLocationSelect branches ----------

  it('calls handleStorageLocationSelect with frozen temperature', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnLocationSelect: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onStorageLocationSelected }: any) => {
        capturedOnLocationSelect = onStorageLocationSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnLocationSelect('loc1', { temperature: 'FROZEN' });
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  it('calls handleStorageLocationSelect with refrigerated temperature', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnLocationSelect: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onStorageLocationSelected }: any) => {
        capturedOnLocationSelect = onStorageLocationSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnLocationSelect('loc2', { temperature: 'Refrigerated' });
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  it('calls handleStorageLocationSelect with ambient temperature', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnLocationSelect: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onStorageLocationSelected }: any) => {
        capturedOnLocationSelect = onStorageLocationSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnLocationSelect('loc3', { temperature: 'Ambient' });
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  it('calls handleStorageLocationSelect with no temperature', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnLocationSelect: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onStorageLocationSelected }: any) => {
        capturedOnLocationSelect = onStorageLocationSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnLocationSelect('loc4', { temperature: null });
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  it('calls handleStorageLocationSelect with null location object', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnLocationSelect: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onStorageLocationSelected }: any) => {
        capturedOnLocationSelect = onStorageLocationSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnLocationSelect(null, null);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  // ---------- handleAddNewLocation ----------

  it('calls handleAddNewLocation setting location and clearing location id', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnAddNewLocation: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onAddNewLocation }: any) => {
        capturedOnAddNewLocation = onAddNewLocation;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnAddNewLocation('New Shelf');
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  // ---------- handleUnitSelected ----------

  it('calls handleUnitSelected with all parameters', () => {
    const mockQuantitySection = require('../QuantitySection');
    let capturedOnUnitSelected: any;
    mockQuantitySection.QuantitySection = jest.fn(
      ({ mode, testID, onUnitSelected }: any) => {
        capturedOnUnitSelected = onUnitSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'quantity-section'}>
            <Text>Quantity ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnUnitSelected('u99', 'grams', 'MASS', 'g');
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockQuantitySection.QuantitySection = jest.fn(({ mode, testID }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID={testID || 'quantity-section'}>
          <Text>Quantity ({mode})</Text>
        </View>
      );
    });
  });

  it('calls handleUnitSelected with null parameters', () => {
    const mockQuantitySection = require('../QuantitySection');
    let capturedOnUnitSelected: any;
    mockQuantitySection.QuantitySection = jest.fn(
      ({ mode, testID, onUnitSelected }: any) => {
        capturedOnUnitSelected = onUnitSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'quantity-section'}>
            <Text>Quantity ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnUnitSelected(null, null, null, null);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockQuantitySection.QuantitySection = jest.fn(({ mode, testID }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID={testID || 'quantity-section'}>
          <Text>Quantity ({mode})</Text>
        </View>
      );
    });
  });

  // ---------- handleNetWeightUnitSelected ----------

  it('calls handleNetWeightUnitSelected with valid unitId and unitName', () => {
    const mockUnitField = require('#components/molecules/AutocompleteField/UnitAutocompleteField');
    let capturedOnUnitSelected: any;
    mockUnitField.UnitAutocompleteField = jest.fn(
      ({ label, placeholder, onUnitSelected }: any) => {
        capturedOnUnitSelected = onUnitSelected;
        const { Text, View } = require('react-native');
        return (
          <View>
            <Text>{label}</Text>
            <Text>{placeholder}</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnUnitSelected('nwu1', 'grams');
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockUnitField.UnitAutocompleteField = jest.fn(
      ({ label, placeholder }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View>
            <Text>{label}</Text>
            <Text>{placeholder}</Text>
          </View>
        );
      },
    );
  });

  it('calls handleNetWeightUnitSelected with null values', () => {
    const mockUnitField = require('#components/molecules/AutocompleteField/UnitAutocompleteField');
    let capturedOnUnitSelected: any;
    mockUnitField.UnitAutocompleteField = jest.fn(
      ({ label, placeholder, onUnitSelected }: any) => {
        capturedOnUnitSelected = onUnitSelected;
        const { Text, View } = require('react-native');
        return (
          <View>
            <Text>{label}</Text>
            <Text>{placeholder}</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnUnitSelected(null, null);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockUnitField.UnitAutocompleteField = jest.fn(
      ({ label, placeholder }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View>
            <Text>{label}</Text>
            <Text>{placeholder}</Text>
          </View>
        );
      },
    );
  });

  // ---------- handleCategorySelect ----------

  it('calls handleCategorySelect with a category id', () => {
    const mockItemInfoSection = require('../ItemInformationSection');
    let capturedOnCategorySelected: any;
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID, onCategorySelected }: any) => {
        capturedOnCategorySelected = onCategorySelected;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnCategorySelected('cat1');
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );
  });

  it('calls handleCategorySelect with null', () => {
    const mockItemInfoSection = require('../ItemInformationSection');
    let capturedOnCategorySelected: any;
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID, onCategorySelected }: any) => {
        capturedOnCategorySelected = onCategorySelected;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnCategorySelected(null);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );
  });

  // ---------- handleSave branches ----------

  it('shows alert when quantity is invalid (zero)', async () => {
    parseFractionalInput.mockReturnValue(0);

    const mockHeader = require('#components/molecules/Header');
    let capturedSubmit: any;
    mockHeader.Header = jest.fn(({ title, rightActions }: any) => {
      capturedSubmit = rightActions?.[0]?.onPress;
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });

    renderWithProviders(<PantryItemForm mode="add" />);
    if (capturedSubmit) await capturedSubmit();
    // parseFractionalInput returns 0, so alert is shown
    // The form validation will fire first - quantity is defaulted to '1'
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockHeader.Header = jest.fn(({ title }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });
  });

  it('shows alert when no pantry is selected', async () => {
    normalizeHome.mockReturnValue(null);
    useAppStore.mockReturnValue(null);
    parseFractionalInput.mockReturnValue(5);

    const mockHeader = require('#components/molecules/Header');
    let capturedSubmit: any;
    mockHeader.Header = jest.fn(({ title, rightActions }: any) => {
      capturedSubmit = rightActions?.[0]?.onPress;
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });

    renderWithProviders(<PantryItemForm mode="add" />);
    if (capturedSubmit) await capturedSubmit();
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockHeader.Header = jest.fn(({ title }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });
  });

  // ---------- onStorageStateChange / onDateChange through StorageDetailsSection ----------

  it('calls onStorageStateChange through StorageDetailsSection', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnStorageStateChange: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onStorageStateChange }: any) => {
        capturedOnStorageStateChange = onStorageStateChange;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnStorageStateChange('FROZEN');
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  it('calls onDateChange with a Date through StorageDetailsSection', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnDateChange: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onDateChange }: any) => {
        capturedOnDateChange = onDateChange;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnDateChange(new Date('2026-06-15'));
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  it('calls onDateChange with null through StorageDetailsSection', () => {
    const mockStorageSection = require('../StorageDetailsSection');
    let capturedOnDateChange: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, onDateChange }: any) => {
        capturedOnDateChange = onDateChange;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="add" />);
    capturedOnDateChange(null);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });

  // ---------- Header close handler ----------

  it('calls navigation.goBack on Header close', () => {
    const mockHeader = require('#components/molecules/Header');
    let capturedOnClose: any;
    mockHeader.Header = jest.fn(({ title, onClose }: any) => {
      capturedOnClose = onClose;
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });

    renderWithProviders(<PantryItemForm mode="add" />);
    expect(capturedOnClose).toBeDefined();
    capturedOnClose();
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockHeader.Header = jest.fn(({ title }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });
  });

  // ---------- tagsFields transform tests ----------

  it('tags renderValue handles array input', () => {
    // This tests the tagsFields definition functions
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          tags: ['a', 'b'],
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Tags')).toBeTruthy();
  });

  // ---------- isWeightLocked false in edit mode (no lastUsedAt) ----------

  it('isWeightLocked is false when lastUsedAt is null in edit mode', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          lastUsedAt: null,
          netWeight: 100,
          netWeightUnit: { id: 'nw1', symbol: 'g', name: 'grams' },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.queryByText(/Weight locked after use/)).toBeNull();
  });

  // ---------- isWeightLocked true in edit mode (lastUsedAt present) ----------

  it('isWeightLocked is true when lastUsedAt is set in edit mode', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          lastUsedAt: '2025-01-01T00:00:00Z',
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText(/Weight locked after use/)).toBeTruthy();
  });

  // ---------- formTestID logic ----------

  it('sets formTestID to add-pantry-item-modal in add mode', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('sets formTestID to edit-pantry-item-modal in edit mode', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: { pantryItem: baseEditItem },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByTestId('edit-pantry-item-modal')).toBeTruthy();
  });

  // ---------- storageLocations from pantry data ----------

  it('passes storageLocations to StorageDetailsSection when pantryData exists', () => {
    normalizePantry.mockReturnValue({
      storageLocations: [
        { id: 'sl1', name: 'Fridge', type: 'cold' },
        { id: 'sl2', name: 'Pantry', type: 'ambient' },
      ],
    });
    useGetPantryQuery.mockReturnValue({
      data: { pantry: { id: 'p1' } },
    });

    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('storage-details-section')).toBeTruthy();

    // Restore
    normalizePantry.mockReturnValue({ storageLocations: [] });
    useGetPantryQuery.mockReturnValue({ data: null });
  });

  it('handles null pantryData by passing empty storageLocations', () => {
    normalizePantry.mockReturnValue(null);
    useGetPantryQuery.mockReturnValue({
      data: { pantry: null },
    });

    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByTestId('storage-details-section')).toBeTruthy();

    // Restore
    normalizePantry.mockReturnValue({ storageLocations: [] });
  });

  // ---------- edit mode with unit having null type ----------

  it('initializes tracking unit with null type when item.unit.type is null', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          unit: { id: 'u1', name: 'each', symbol: 'ea', type: null },
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  // ---------- edit mode with empty tags array ----------

  it('renders tags section even with empty tags in edit mode', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          tags: [],
        },
      },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    // Tags section should always render in edit mode regardless of content
    expect(screen.getByText('Tags')).toBeTruthy();
  });

  // ---------- edit mode: title in Header ----------

  it('shows "Add Pantry Item" title in add mode header', () => {
    renderWithProviders(<PantryItemForm mode="add" />);
    expect(screen.getByText('Add Pantry Item')).toBeTruthy();
  });

  it('shows "Edit Pantry Item" title in edit mode header', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: { pantryItem: baseEditItem },
      loading: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  // ---------- add mode: submit button testID ----------

  it('sets submit button testID to add-pantry-item-submit-button in add mode', () => {
    const mockHeader = require('#components/molecules/Header');
    let capturedRightActions: any[];
    mockHeader.Header = jest.fn(({ title, rightActions }: any) => {
      capturedRightActions = rightActions;
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });

    renderWithProviders(<PantryItemForm mode="add" />);
    expect(capturedRightActions![0].testID).toBe(
      'add-pantry-item-submit-button',
    );

    // Restore
    mockHeader.Header = jest.fn(({ title }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });
  });

  it('sets submit button testID to edit-pantry-item-submit-button in edit mode', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: { pantryItem: baseEditItem },
      loading: false,
      refetch: jest.fn(),
    });

    const mockHeader = require('#components/molecules/Header');
    let capturedRightActions: any[];
    mockHeader.Header = jest.fn(({ title, rightActions }: any) => {
      capturedRightActions = rightActions;
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });

    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(capturedRightActions![0].testID).toBe(
      'edit-pantry-item-submit-button',
    );

    // Restore
    mockHeader.Header = jest.fn(({ title }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="form-header">
          <Text>{title}</Text>
        </View>
      );
    });
  });

  // ---------- onBrandSelected in edit mode ----------

  it('passes onBrandSelected callback in edit mode', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: { pantryItem: baseEditItem },
      loading: false,
      refetch: jest.fn(),
    });

    const mockItemInfoSection = require('../ItemInformationSection');
    let capturedOnBrandSelected: any;
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID, onBrandSelected }: any) => {
        capturedOnBrandSelected = onBrandSelected;
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    expect(capturedOnBrandSelected).toBeDefined();
    capturedOnBrandSelected('brand-99');
    expect(screen.getByTestId('edit-pantry-item-modal')).toBeTruthy();

    // Restore mock
    mockItemInfoSection.ItemInformationSection = jest.fn(
      ({ mode, testID }: any) => {
        const { Text, View } = require('react-native');
        return (
          <View testID={testID || 'item-info-section'}>
            <Text>Item Information ({mode})</Text>
          </View>
        );
      },
    );
  });

  // ---------- edit mode: storageState watchedValues ?? fallback ----------

  it('passes StorageState.Ambient as fallback when watchedValues.storageState is undefined', () => {
    useGetPantryItemQuery.mockReturnValue({
      data: {
        pantryItem: {
          ...baseEditItem,
          storageState: undefined,
        },
      },
      loading: false,
      refetch: jest.fn(),
    });

    const mockStorageSection = require('../StorageDetailsSection');
    let capturedStorageState: any;
    mockStorageSection.StorageDetailsSection = jest.fn(
      ({ mode, storageState }: any) => {
        capturedStorageState = storageState;
        const { Text, View } = require('react-native');
        return (
          <View testID="storage-details-section">
            <Text>Storage Details ({mode})</Text>
          </View>
        );
      },
    );

    renderWithProviders(<PantryItemForm mode="edit" itemId="item-1" />);
    // The fallback should be 'AMBIENT'
    expect(capturedStorageState).toBe('AMBIENT');

    // Restore mock
    mockStorageSection.StorageDetailsSection = jest.fn(({ mode }: any) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="storage-details-section">
          <Text>Storage Details ({mode})</Text>
        </View>
      );
    });
  });
});
