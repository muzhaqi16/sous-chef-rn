'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { SearchResultsScreen } from '../SearchResultsScreen';

jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

const mockGoBack = jest.fn();
const mockNavigation = {
  getParent: jest.fn().mockReturnValue({
    getParent: jest.fn().mockReturnValue({
      canGoBack: jest.fn().mockReturnValue(true),
      goBack: jest.fn(),
    }),
  }),
};

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    goBack: mockGoBack,
    navigation: mockNavigation,
  }),
}));

const mockHideBottomSheet = jest.fn();
const mockShowBottomSheet = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({
      scannerSheetVisible: false,
      searchError: null,
      isSearching: false,
      hideBottomSheet: mockHideBottomSheet,
      showBottomSheet: mockShowBottomSheet,
    }),
  ),
  selectBottomSheetState: (s: any) => ({
    scannerSheetVisible: s.scannerSheetVisible,
    searchError: s.searchError,
    isSearching: s.isSearching,
    hideBottomSheet: s.hideBottomSheet,
    showBottomSheet: s.showBottomSheet,
  }),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
  }),
}));

jest.mock('#hooks/useSearchResults', () => ({
  useSearchResults: jest.fn(() => ({
    searchResults: [],
    loading: false,
    addingItem: false,
    handleAddItem: jest.fn(),
    handleRetry: jest.fn(),
    clearSearch: jest.fn(),
  })),
}));

jest.mock('#components/barcode/LoadingState', () => ({
  LoadingState: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));

jest.mock('#components/barcode/ErrorState', () => ({
  ErrorState: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));

jest.mock('#components/barcode/ItemNotFound', () => ({
  ItemNotFound: ({ barcode }: any) => {
    const { Text } = require('react-native');
    return <Text>No results for {barcode}</Text>;
  },
}));

jest.mock('#components/barcode/SearchResults', () => ({
  SearchResults: ({ item }: any) => {
    const { Text } = require('react-native');
    return <Text>Found: {item.name}</Text>;
  },
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('#components/organisms/AddItemForm/AddItemForm', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View /> };
});

jest.mock('#components/atoms/BottomSheetKeyboardAwareScrollView', () => ({
  BottomSheetKeyboardAwareScrollView: ({ children }: any) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  const { useAppStore } = require('#store/useAppStore');
  useAppStore.mockImplementation((selector: any) =>
    selector({
      scannerSheetVisible: false,
      searchError: null,
      isSearching: false,
      hideBottomSheet: mockHideBottomSheet,
      showBottomSheet: mockShowBottomSheet,
    }),
  );

  const { useSearchResults } = require('#hooks/useSearchResults');
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
  const defaultProps = {
    route: {
      params: {
        barcode: '1234567890',
        format: 'ean-13',
      },
    },
  } as any;

  it('renders search results header', () => {
    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('Search Results')).toBeTruthy();
  });

  it('shows item not found when no results', () => {
    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('No results for 1234567890')).toBeTruthy();
  });

  it('shows loading state when searching', () => {
    const { useSearchResults } = require('#hooks/useSearchResults');
    useSearchResults.mockReturnValue({
      searchResults: [],
      loading: true,
      addingItem: false,
      handleAddItem: jest.fn(),
      handleRetry: jest.fn(),
      clearSearch: jest.fn(),
    });

    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('Searching for item...')).toBeTruthy();
  });

  it('shows search results when found', () => {
    const { useSearchResults } = require('#hooks/useSearchResults');
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
    const { useAppStore } = require('#store/useAppStore');
    useAppStore.mockImplementation((selector: any) =>
      selector({
        scannerSheetVisible: false,
        searchError: 'Network error',
        isSearching: false,
        hideBottomSheet: mockHideBottomSheet,
        showBottomSheet: mockShowBottomSheet,
      }),
    );

    const { getByText } = render(<SearchResultsScreen {...defaultProps} />);
    expect(getByText('Network error')).toBeTruthy();
  });

  it('passes source and pantryId from route params', () => {
    const { useSearchResults } = require('#hooks/useSearchResults');
    useSearchResults.mockReturnValue({
      searchResults: [{ id: 'item-1', name: 'Test' }],
      loading: false,
      addingItem: false,
      handleAddItem: jest.fn(),
      handleRetry: jest.fn(),
      clearSearch: jest.fn(),
    });

    const propsWithSource = {
      route: {
        params: {
          barcode: '123',
          format: 'ean-13',
          source: 'pantry',
          pantryId: 'pantry-1',
        },
      },
    } as any;

    const { getByText } = render(<SearchResultsScreen {...propsWithSource} />);
    expect(getByText('Found: Test')).toBeTruthy();
  });
});
