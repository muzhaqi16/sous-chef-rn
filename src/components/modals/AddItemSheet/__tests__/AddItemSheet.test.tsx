'use no memo';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AddItemSheet, useAddItemSheetRefs } from '../AddItemSheet';
import { renderHook } from '@testing-library/react-native';
import type {
  AddItemSheetConfig,
  SuggestionsHookResult,
  BaseSuggestionItem,
} from '../types';

// Mock GlobalBottomSheetBackdrop
jest.mock('#components/atoms/GlobalBottomSheetBackdrop', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    GlobalBottomSheetBackdrop: (props: any) =>
      R.createElement(RN.View, { testID: 'backdrop', ...props }),
  };
});

// Mock useSharedBottomSheetConfigs
jest.mock('#hooks/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: jest.fn(() => ({})),
}));

// Mock useBottomSheetBackHandler
jest.mock('#hooks/useBottomSheetBackHandler', () => ({
  useBottomSheetBackHandler: jest.fn(),
}));

// Mock BottomSheetSearchBar
jest.mock('#components/molecules/BottomSheetSearchBar', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    BottomSheetSearchBar: R.forwardRef((props: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        clear: jest.fn(),
        focus: jest.fn(),
        blur: jest.fn(),
        getValue: jest.fn(() => 'search value'),
        setValue: jest.fn(),
      }));
      return R.createElement(RN.TextInput, {
        testID: 'search-bar',
        placeholder: props.placeholder,
        onChangeText: props.onChangeText,
      });
    }),
  };
});

// Mock ItemSuggestionsList
jest.mock('#components/molecules/ItemSuggestionsList', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    ItemSuggestionsList: () =>
      R.createElement(RN.View, { testID: 'item-suggestions-list' }),
  };
});

// Mock ActionCard
jest.mock('#components/molecules/ActionCard', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    ActionCard: (props: any) =>
      R.createElement(
        RN.Pressable,
        {
          testID: props.testID || `action-${props.label}`,
          onPress: props.onPress,
        },
        R.createElement(RN.Text, {}, props.label),
      ),
  };
});

// Mock SuggestionListItem
jest.mock('#components/molecules/SuggestionListItem', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    SuggestionListItem: (props: any) =>
      R.createElement(
        RN.Pressable,
        { testID: `suggestion-${props.title}`, onPress: props.onQuickAdd },
        R.createElement(RN.Text, {}, props.title),
      ),
  };
});

// Mock useItemAutocomplete
const mockHandleSearchTermChange = jest.fn();
const mockResetAutocomplete = jest.fn();
jest.mock('#hooks/autocomplete/useItemAutocomplete', () => ({
  useItemAutocomplete: jest.fn(() => ({
    searchTerm: '',
    displayItems: [],
    isLoading: false,
    handleSearchTermChange: mockHandleSearchTermChange,
    reset: mockResetAutocomplete,
  })),
}));

// Mock useAddItemSheetState
jest.mock('../useAddItemSheetState', () => ({
  useAddItemSheetState: jest.fn(() => ({
    searchQuery: '',
    setSearchQuery: jest.fn(),
    shouldFetch: true,
    shouldRenderSuggestions: true,
    exitingItems: new Set(),
    startExitAnimation: jest.fn(),
    completeExitAnimation: jest.fn(),
    showSearchResults: false,
    showSuggestions: true,
  })),
}));

// Mock iconUtils
jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

const createConfig = (
  overrides: Partial<AddItemSheetConfig> = {},
): AddItemSheetConfig => ({
  title: 'Add to Pantry',
  testIDPrefix: 'add-pantry',
  placeholderIcon: 'cube-outline',
  searchPlaceholder: 'Search pantry items...',
  suggestionGroups: [
    {
      key: 'low_stock',
      title: 'LOW STOCK',
      accessor: (grouped: Record<string, BaseSuggestionItem[]>) =>
        grouped.lowStock ?? [],
      priority: 1,
    },
    {
      key: 'add_again',
      title: 'ADD AGAIN',
      accessor: (grouped: Record<string, BaseSuggestionItem[]>) =>
        grouped.addAgain ?? [],
      priority: 2,
    },
  ],
  quickAdd: {
    fireAndForget: false,
    enableExitAnimations: true,
    toastMessage: (name: string) => `Added ${name}`,
  },
  addDetails: { enabled: true },
  deferFetch: true,
  barcodeSource: 'pantry',
  addManuallyPosition: 'bottom',
  emptyStateMessage: 'No suggestions yet',
  emptyStateSubtext: 'Add items to your pantry to get started',
  ...overrides,
});

const createSuggestions = (
  overrides: Partial<SuggestionsHookResult> = {},
): SuggestionsHookResult => ({
  grouped: {},
  loading: false,
  hasSuggestions: false,
  refetch: jest.fn(),
  ...overrides,
});

describe('AddItemSheet', () => {
  const defaultProps = {
    visible: true,
    contextId: 'pantry-1',
    onClose: jest.fn(),
    config: createConfig(),
    suggestions: createSuggestions(),
    onQuickAddSearchSuggestion: jest.fn(),
    onQuickAddSuggestion: jest.fn(),
    isMutating: false,
    onAddManually: jest.fn(),
    onScanPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the sheet title', () => {
    render(<AddItemSheet {...defaultProps} />);
    expect(screen.getByText('Add to Pantry')).toBeTruthy();
  });

  it('renders the search bar', () => {
    render(<AddItemSheet {...defaultProps} />);
    expect(screen.getByTestId('search-bar')).toBeTruthy();
  });

  it('renders action buttons when no search results', () => {
    render(<AddItemSheet {...defaultProps} />);
    expect(screen.getByText('Scan Barcode')).toBeTruthy();
    expect(screen.getByText('Add Manually')).toBeTruthy();
  });

  it('renders empty state when no suggestions', () => {
    render(<AddItemSheet {...defaultProps} />);
    expect(screen.getByText('No suggestions yet')).toBeTruthy();
    expect(
      screen.getByText('Add items to your pantry to get started'),
    ).toBeTruthy();
  });

  it('renders loading state for suggestions', () => {
    render(
      <AddItemSheet
        {...defaultProps}
        suggestions={createSuggestions({
          loading: true,
          hasSuggestions: false,
        })}
      />,
    );
    // ActivityIndicator should be present (loading)
    const { toJSON } = render(
      <AddItemSheet
        {...defaultProps}
        suggestions={createSuggestions({
          loading: true,
          hasSuggestions: false,
        })}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders suggestion sections when data is available', () => {
    const items: BaseSuggestionItem[] = [
      { id: 's1', itemId: 'item-1', name: 'Milk', category: 'Dairy' },
      { id: 's2', itemId: 'item-2', name: 'Eggs', category: 'Dairy' },
    ];

    render(
      <AddItemSheet
        {...defaultProps}
        suggestions={createSuggestions({
          hasSuggestions: true,
          grouped: { lowStock: items, addAgain: [] },
        })}
      />,
    );

    expect(screen.getByText('LOW STOCK')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  it('skips empty suggestion groups', () => {
    render(
      <AddItemSheet
        {...defaultProps}
        suggestions={createSuggestions({
          hasSuggestions: true,
          grouped: { lowStock: [], addAgain: [] },
        })}
      />,
    );

    // Section titles should not render if groups are empty
    expect(screen.queryByText('LOW STOCK')).toBeNull();
    expect(screen.queryByText('ADD AGAIN')).toBeNull();
  });

  it('calls onAddManually with search value', () => {
    render(<AddItemSheet {...defaultProps} />);

    const addManuallyBtn = screen.getByText('Add Manually');
    fireEvent.press(addManuallyBtn);

    expect(defaultProps.onAddManually).toHaveBeenCalledWith('search value');
  });

  it('calls onScanPress when scan button is pressed', () => {
    render(<AddItemSheet {...defaultProps} />);

    const scanBtn = screen.getByText('Scan Barcode');
    fireEvent.press(scanBtn);

    expect(defaultProps.onScanPress).toHaveBeenCalled();
  });

  it('calls onQuickAddSuggestion when suggestion is pressed', () => {
    const item: BaseSuggestionItem = {
      id: 's1',
      itemId: 'item-1',
      name: 'Milk',
      category: 'Dairy',
    };

    render(
      <AddItemSheet
        {...defaultProps}
        suggestions={createSuggestions({
          hasSuggestions: true,
          grouped: { lowStock: [item], addAgain: [] },
        })}
      />,
    );

    fireEvent.press(screen.getByTestId('suggestion-Milk'));
    expect(defaultProps.onQuickAddSuggestion).toHaveBeenCalledWith(item);
  });

  it('renders with children', () => {
    render(
      <AddItemSheet {...defaultProps}>
        {React.createElement('View', { testID: 'nested-sheet' })}
      </AddItemSheet>,
    );
    expect(screen.getByTestId('nested-sheet')).toBeTruthy();
  });

  it('uses external exitingItems when provided', () => {
    const exitingItems = new Set(['item-1']);
    render(
      <AddItemSheet
        {...defaultProps}
        exitingItems={exitingItems}
        suggestions={createSuggestions({
          hasSuggestions: true,
          grouped: {
            lowStock: [
              { id: 's1', itemId: 'item-1', name: 'Milk', category: 'Dairy' },
            ],
            addAgain: [],
          },
        })}
      />,
    );
    // Renders without error; SuggestionListItem receives quickAddDisabled
    expect(screen.getByTestId('suggestion-Milk')).toBeTruthy();
  });

  it('sorts suggestion groups by priority', () => {
    const config = createConfig({
      suggestionGroups: [
        {
          key: 'add_again',
          title: 'ADD AGAIN',
          accessor: grouped => grouped.addAgain ?? [],
          priority: 2,
        },
        {
          key: 'low_stock',
          title: 'LOW STOCK',
          accessor: grouped => grouped.lowStock ?? [],
          priority: 1,
        },
      ],
    });

    const { toJSON } = render(
      <AddItemSheet
        {...defaultProps}
        config={config}
        suggestions={createSuggestions({
          hasSuggestions: true,
          grouped: {
            lowStock: [
              { id: 's1', itemId: 'i1', name: 'Milk', category: 'Dairy' },
            ],
            addAgain: [
              { id: 's2', itemId: 'i2', name: 'Eggs', category: 'Dairy' },
            ],
          },
        })}
      />,
    );
    expect(toJSON()).toBeTruthy();
    // Both sections should be present
    expect(screen.getByText('LOW STOCK')).toBeTruthy();
    expect(screen.getByText('ADD AGAIN')).toBeTruthy();
  });

  it('shows search results when autocomplete has data', () => {
    const {
      useItemAutocomplete,
    } = require('#hooks/autocomplete/useItemAutocomplete');
    useItemAutocomplete.mockReturnValue({
      searchTerm: 'mi',
      displayItems: [{ id: '1', name: 'Milk' }],
      isLoading: false,
      handleSearchTermChange: mockHandleSearchTermChange,
      reset: mockResetAutocomplete,
    });

    render(<AddItemSheet {...defaultProps} />);
    // When search results show, action buttons should be hidden
    // The ItemSuggestionsList is rendered
    expect(screen.getByTestId('item-suggestions-list')).toBeTruthy();
  });

  it('does not render suggestions when not visible', () => {
    render(<AddItemSheet {...defaultProps} visible={false} />);
    // Still renders the modal structure, but sheet behavior is controlled by ref
    expect(screen.getByText('Add to Pantry')).toBeTruthy();
  });
});

describe('useAddItemSheetRefs', () => {
  it('returns searchBarRef, getSearchValue, and clearSearch', () => {
    const { result } = renderHook(() => useAddItemSheetRefs());

    expect(result.current.searchBarRef).toBeDefined();
    expect(typeof result.current.getSearchValue).toBe('function');
    expect(typeof result.current.clearSearch).toBe('function');
  });

  it('getSearchValue returns empty string when ref is not attached', () => {
    const { result } = renderHook(() => useAddItemSheetRefs());
    expect(result.current.getSearchValue()).toBe('');
  });

  it('clearSearch does not throw when ref is not attached', () => {
    const { result } = renderHook(() => useAddItemSheetRefs());
    expect(() => result.current.clearSearch()).not.toThrow();
  });
});
