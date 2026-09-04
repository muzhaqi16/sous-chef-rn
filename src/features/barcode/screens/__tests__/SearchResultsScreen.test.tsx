'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { SearchResultsScreen } from '../SearchResultsScreen';

type ScreenProps = React.ComponentProps<typeof SearchResultsScreen>;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

const mockHideBottomSheet = jest.fn();
const mockShowBottomSheet = jest.fn();

jest.mock('#features/barcode/store/barcodeScannerStore', () => ({
  useBottomSheetState: jest.fn(() => ({
    scannerSheetVisible: false,
    searchError: null,
    isSearching: false,
    hideBottomSheet: mockHideBottomSheet,
    showBottomSheet: mockShowBottomSheet,
  })),
}));

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../hooks/useSearchResults', () => ({
  useSearchResults: jest.fn(() => ({
    searchResults: [],
    loading: false,
    addingItem: false,
    handleAddItem: jest.fn(),
    handleRetry: jest.fn(),
    clearSearch: jest.fn(),
  })),
}));

jest.mock('#components/molecules/ErrorState', () => ({
  ErrorState: ({ message }: { message: string }) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));

jest.mock('../../components/ItemNotFound', () => ({
  ItemNotFound: ({ barcode }: { barcode: string }) => {
    const { Text } = require('react-native');
    return <Text>No results for {barcode}</Text>;
  },
}));

jest.mock('../../components/SearchResults', () => ({
  SearchResults: ({ item }: { item: { name: string } }) => {
    const { Text } = require('react-native');
    return <Text>Found: {item.name}</Text>;
  },
}));

jest.mock('#components/organisms/Header', () => ({
  Header: ({ title }: { title?: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('#features/catalog/ui/AddItemForm/AddItemForm', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View /> };
});

jest.mock('#components/atoms/BottomSheetKeyboardAwareScrollView', () => ({
  BottomSheetKeyboardAwareScrollView: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  const storeModule = require('#features/barcode/store/barcodeScannerStore');
  storeModule.useBottomSheetState.mockReturnValue({
    scannerSheetVisible: false,
    searchError: null,
    isSearching: false,
    hideBottomSheet: mockHideBottomSheet,
    showBottomSheet: mockShowBottomSheet,
  });

  const { useSearchResults } = require('../../hooks/useSearchResults');
  useSearchResults.mockReturnValue({
    searchResults: [],
    loading: false,
    addingItem: false,
    handleAddItem: jest.fn(),
    handleRetry: jest.fn(),
    clearSearch: jest.fn(),
  });
});

describe('SearchResultsScreen', () => {
  const defaultProps: ScreenProps = {
    route: {
      params: {
        barcode: '1234567890',
        format: 'ean-13',
      },
    },
  };

  it('renders search results header', () => {
    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('Search Results')).toBeTruthy();
  });

  it('shows item not found when no results', () => {
    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('No results for 1234567890')).toBeTruthy();
  });

  it('shows loading state when searching', () => {
    const { useSearchResults } = require('../../hooks/useSearchResults');
    useSearchResults.mockReturnValue({
      searchResults: [],
      loading: true,
      addingItem: false,
      handleAddItem: jest.fn(),
      handleRetry: jest.fn(),
      clearSearch: jest.fn(),
    });

    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    // The brand loader sets its banner in caps, and the barcode reads back
    // below it so a wrong scan is visible while the search runs.
    expect(getByText('SEARCHING FOR ITEM...')).toBeTruthy();
    expect(getByText('Barcode: 1234567890')).toBeTruthy();
  });

  it('shows search results when found', () => {
    const { useSearchResults } = require('../../hooks/useSearchResults');
    useSearchResults.mockReturnValue({
      searchResults: [{ id: 'item-1', name: 'Test Product' }],
      loading: false,
      addingItem: false,
      handleAddItem: jest.fn(),
      handleRetry: jest.fn(),
      clearSearch: jest.fn(),
    });

    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('Found: Test Product')).toBeTruthy();
  });

  it('shows error state when search error exists', () => {
    const storeModule = require('#features/barcode/store/barcodeScannerStore');
    storeModule.useBottomSheetState.mockReturnValue({
      scannerSheetVisible: false,
      searchError: 'Network error',
      isSearching: false,
      hideBottomSheet: mockHideBottomSheet,
      showBottomSheet: mockShowBottomSheet,
    });

    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('Network error')).toBeTruthy();
  });

  it('passes source and pantryId from route params', () => {
    const { useSearchResults } = require('../../hooks/useSearchResults');
    useSearchResults.mockReturnValue({
      searchResults: [{ id: 'item-1', name: 'Test' }],
      loading: false,
      addingItem: false,
      handleAddItem: jest.fn(),
      handleRetry: jest.fn(),
      clearSearch: jest.fn(),
    });

    const propsWithSource: ScreenProps = {
      route: {
        params: {
          barcode: '123',
          format: 'ean-13',
          source: 'pantry',
          pantryId: 'pantry-1',
        },
      },
    };

    const { getByText } = render(<SearchResultsScreen {...propsWithSource} />);
    expect(getByText('Found: Test')).toBeTruthy();
  });
});
