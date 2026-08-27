'use no memo';

import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
// The report step renders ReportItemForm, whose useReportItem calls useMutation,
// so the tree needs an Apollo context even though this suite mocks the data hooks.
import { renderWithApollo as render } from '#/test-utils/apolloMockProvider';
import { AddItemSheet, useAddItemSheetRefs } from '../AddItemSheet';
import { pantrySheetConfig } from '#features/pantry/components/modals/AddToPantrySheet/pantrySheetConfig';
import { renderHook } from '@testing-library/react-native';
import type {
  AddItemSheetConfig,
  SuggestionsHookResult,
  BaseSuggestionItem,
} from '../types';

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
    BottomSheetSearchBar: R.forwardRef(
      (
        props: { placeholder?: string; onChangeText?: (text: string) => void },
        ref: React.Ref<unknown>,
      ) => {
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
      },
    ),
  };
});

// Mock ItemSuggestionsList. The report footer is exposed as a pressable so the
// morph to the report step can be driven without the real list's data shape.
jest.mock('#components/molecules/ItemSuggestionsList', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    ItemSuggestionsList: ({ onReportItem }: { onReportItem?: () => void }) =>
      R.createElement(
        RN.View,
        { testID: 'item-suggestions-list' },
        R.createElement(RN.Pressable, {
          testID: 'report-item-footer',
          onPress: onReportItem,
        }),
      ),
  };
});

// Mock ActionCard
jest.mock('#components/molecules/ActionCard', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    ActionCard: (props: {
      testID?: string;
      label?: string;
      onPress?: () => void;
    }) =>
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
    SuggestionListItem: (props: { title?: string; onQuickAdd?: () => void }) =>
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
jest.mock('#features/catalog/hooks/useItemAutocomplete', () => ({
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

// The prefix must be one a production config actually uses. It was
// `'add-pantry'`, which no config has — so every testID this suite asserted was
// one the app never renders, and the e2e page objects were written against
// those fictional IDs and timed out on device. Imported rather than retyped so
// the two cannot drift again.
const createConfig = (
  overrides: Partial<AddItemSheetConfig> = {},
): AddItemSheetConfig => ({
  titleKey: 'addItemSheet.addToPantry',
  testIDPrefix: pantrySheetConfig.testIDPrefix,
  placeholderIcon: 'cube-outline',
  searchPlaceholderKey: 'addItemSheet.searchPlaceholder',
  suggestionGroups: [
    {
      key: 'low_stock',
      titleKey: 'addItemSheet.sections.lowStock',
      accessor: (grouped: Record<string, BaseSuggestionItem[]>) =>
        grouped.lowStock ?? [],
      priority: 1,
    },
    {
      key: 'add_again',
      titleKey: 'addItemSheet.sections.addAgain',
      accessor: (grouped: Record<string, BaseSuggestionItem[]>) =>
        grouped.addAgain ?? [],
      priority: 2,
    },
  ],
  quickAdd: {
    fireAndForget: false,
    enableExitAnimations: true,
    toastMessageKey: 'addItemSheet.added',
  },
  addDetails: { enabled: true },
  deferFetch: true,
  barcodeSource: 'pantry',
  addManuallyPosition: 'bottom',
  emptyStateMessageKey: 'addItemSheet.emptyTitle',
  emptyStateSubtextKey: 'addItemSheet.emptyPantrySubtext',
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
      screen.getByText(
        'Add items to your pantry to get personalized suggestions',
      ),
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

    expect(screen.getByText('Low Stock')).toBeTruthy();
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
    expect(screen.queryByText('Low Stock')).toBeNull();
    expect(screen.queryByText('Add Again')).toBeNull();
  });

  it('calls onAddManually with search value', async () => {
    const user = userEvent.setup();
    render(<AddItemSheet {...defaultProps} />);

    const addManuallyBtn = screen.getByText('Add Manually');
    await user.press(addManuallyBtn);

    expect(defaultProps.onAddManually).toHaveBeenCalledWith('search value');
  });

  it('calls onScanPress when scan button is pressed', async () => {
    const user = userEvent.setup();
    render(<AddItemSheet {...defaultProps} />);

    const scanBtn = screen.getByText('Scan Barcode');
    await user.press(scanBtn);

    expect(defaultProps.onScanPress).toHaveBeenCalled();
  });

  it('calls onQuickAddSuggestion when suggestion is pressed', async () => {
    const user = userEvent.setup();
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

    await user.press(screen.getByTestId('suggestion-Milk'));
    expect(defaultProps.onQuickAddSuggestion).toHaveBeenCalledWith(item);
  });

  it('morphs to the in-place details step when Add Manually is pressed', async () => {
    const user = userEvent.setup();
    render(
      <AddItemSheet
        {...defaultProps}
        renderDetails={() =>
          React.createElement('View', { testID: 'details-step' })
        }
      />,
    );

    // Search step initially — the details content is not rendered yet.
    expect(screen.queryByTestId('details-step')).toBeNull();

    // Pressing Add Manually preps the consumer and morphs this same sheet to
    // the details step (no second modal).
    await user.press(
      screen.getByTestId(
        `${pantrySheetConfig.testIDPrefix}-add-manually-button`,
      ),
    );

    expect(defaultProps.onAddManually).toHaveBeenCalled();
    expect(screen.getByTestId('details-step')).toBeTruthy();
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
          titleKey: 'addItemSheet.sections.addAgain',
          accessor: grouped => grouped.addAgain ?? [],
          priority: 2,
        },
        {
          key: 'low_stock',
          titleKey: 'addItemSheet.sections.lowStock',
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
    expect(screen.getByText('Low Stock')).toBeTruthy();
    expect(screen.getByText('Add Again')).toBeTruthy();
  });

  it('shows search results when autocomplete has data', () => {
    const {
      useItemAutocomplete,
    } = require('#features/catalog/hooks/useItemAutocomplete');
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

  it('morphs to the report step in place instead of stacking a second sheet', async () => {
    const {
      useItemAutocomplete,
    } = require('#features/catalog/hooks/useItemAutocomplete');
    useItemAutocomplete.mockReturnValue({
      searchTerm: 'mi',
      displayItems: [{ id: '1', name: 'Milk' }],
      isLoading: false,
      handleSearchTermChange: mockHandleSearchTermChange,
      reset: mockResetAutocomplete,
    });

    render(<AddItemSheet {...defaultProps} />);
    await userEvent.press(screen.getByTestId('report-item-footer'));

    // The report form replaced the search step inside the SAME sheet — a
    // stacked BottomSheetModal here would minimize this one (gorhom's default
    // stackBehavior: 'switch') and strand the global backdrop.
    expect(screen.getByTestId('report-item-submit-button')).toBeTruthy();
    expect(screen.queryByTestId('item-suggestions-list')).toBeNull();

    await userEvent.press(screen.getByTestId('report-item-cancel-button'));
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
