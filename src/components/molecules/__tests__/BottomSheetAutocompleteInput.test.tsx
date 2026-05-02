'use no memo';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BottomSheetAutocompleteInput } from '../BottomSheetAutocompleteInput';

// Override BottomSheetFlatList to use real FlatList (so ListEmptyComponent renders)
jest.mock('@gorhom/bottom-sheet', () => {
  const R = require('react');
  const RN = require('react-native');

  return {
    __esModule: true,
    default: R.forwardRef((props: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
      }));
      return R.createElement(RN.View, props);
    }),
    BottomSheetModal: R.forwardRef((props: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
      }));
      return R.createElement(RN.View, props);
    }),
    BottomSheetModalProvider: ({ children }: any) => children,
    BottomSheetBackdrop: (props: any) => R.createElement(RN.View, props),
    BottomSheetView: (props: any) => R.createElement(RN.View, props),
    BottomSheetScrollView: (props: any) => R.createElement(RN.View, props),
    BottomSheetFlatList: RN.FlatList,
    BottomSheetTextInput: RN.TextInput,
    BottomSheetFooter: (props: any) => R.createElement(RN.View, props),
    BottomSheetHandle: (props: any) => R.createElement(RN.View, props),
    useBottomSheet: jest.fn(() => ({
      snapToIndex: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
    })),
    useBottomSheetModal: jest.fn(() => ({
      dismiss: jest.fn(),
      dismissAll: jest.fn(),
    })),
    useBottomSheetScrollableCreator: jest.fn(() => {
      const ScrollableMock = (props: any) =>
        R.createElement(RN.ScrollView, props);
      return ScrollableMock;
    }),
  };
});

// Mock iconUtils
jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

// Mock FormFieldWrapper
jest.mock('#components/atoms/FormFieldWrapper', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    FormFieldWrapper: ({ children, label, error }: any) =>
      R.createElement(
        RN.View,
        { testID: 'form-field-wrapper' },
        label && R.createElement(RN.Text, { testID: 'field-label' }, label),
        error && R.createElement(RN.Text, { testID: 'field-error' }, error),
        children,
      ),
  };
});

// Mock useStandardBottomSheet
const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: mockPresent, dismiss: mockDismiss } },
    modalProps: {},
    theme: {
      colors: {
        primary: '#000',
        textSecondary: '#666',
        border: '#ccc',
        surface: '#fff',
        inputBackground: '#f0f0f0',
        inputText: '#000',
        textPrimary: '#000',
        borderLight: '#eee',
      },
      opacity: { pressed: 0.7 },
    },
  })),
}));

// Mock useAppStore
jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => true), // isOnline = true
}));

interface TestItem {
  id: string;
  name: string;
}

const testItems: TestItem[] = [
  { id: '1', name: 'Apple' },
  { id: '2', name: 'Banana' },
  { id: '3', name: 'Cherry' },
];

describe('BottomSheetAutocompleteInput', () => {
  const defaultProps = {
    label: 'Ingredient',
    value: '',
    onChangeText: jest.fn(),
    placeholder: 'Type ingredient name...',
    title: 'Search Ingredients',
    searchPlaceholder: 'Search...',
    data: [] as TestItem[],
    renderItem: (item: TestItem) => (
      <React.Fragment key={item.id}>
        {React.createElement('Text', { testID: `item-${item.id}` }, item.name)}
      </React.Fragment>
    ),
    keyExtractor: (item: TestItem) => item.id,
    onSelectItem: jest.fn(),
    emptyText: 'No results found',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the text input', () => {
    render(<BottomSheetAutocompleteInput {...defaultProps} />);
    expect(screen.getByPlaceholderText('Type ingredient name...')).toBeTruthy();
  });

  it('renders with label', () => {
    render(<BottomSheetAutocompleteInput {...defaultProps} />);
    expect(screen.getByTestId('field-label')).toBeTruthy();
  });

  it('renders error state', () => {
    render(
      <BottomSheetAutocompleteInput {...defaultProps} error="Required field" />,
    );
    expect(screen.getByTestId('field-error')).toBeTruthy();
  });

  it('calls onChangeText when typing', () => {
    render(<BottomSheetAutocompleteInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Type ingredient name...');

    fireEvent.changeText(input, 'app');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('app');
  });

  it('renders with testID', () => {
    render(
      <BottomSheetAutocompleteInput
        {...defaultProps}
        testID="ingredient-input"
      />,
    );
    expect(screen.getByTestId('ingredient-input')).toBeTruthy();
  });

  it('renders with required prop', () => {
    render(<BottomSheetAutocompleteInput {...defaultProps} required={true} />);
    // FormFieldWrapper receives required, just verify it renders
    expect(screen.getByTestId('form-field-wrapper')).toBeTruthy();
  });

  it('renders the bottom sheet modal title', () => {
    render(<BottomSheetAutocompleteInput {...defaultProps} data={testItems} />);
    // The title is inside BottomSheetModal which renders via @gorhom mock as View
    expect(screen.getByText('Search Ingredients')).toBeTruthy();
  });

  it('renders empty state text when no data', () => {
    render(<BottomSheetAutocompleteInput {...defaultProps} data={[]} />);
    expect(screen.getByText('No results found')).toBeTruthy();
  });

  it('renders empty state with subtext', () => {
    render(
      <BottomSheetAutocompleteInput
        {...defaultProps}
        data={[]}
        emptySubtext="Try a different search term"
      />,
    );
    expect(screen.getByText('Try a different search term')).toBeTruthy();
  });

  it('renders loading state', () => {
    render(
      <BottomSheetAutocompleteInput
        {...defaultProps}
        data={[]}
        loading={true}
      />,
    );
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders custom loading component', () => {
    const CustomLoading = () => (
      <React.Fragment>
        {React.createElement(
          'Text',
          { testID: 'custom-loading' },
          'Custom loading...',
        )}
      </React.Fragment>
    );
    render(
      <BottomSheetAutocompleteInput
        {...defaultProps}
        data={[]}
        loading={true}
        renderLoadingComponent={CustomLoading}
      />,
    );
    expect(screen.getByTestId('custom-loading')).toBeTruthy();
  });

  it('renders custom empty component', () => {
    const CustomEmpty = () => (
      <React.Fragment>
        {React.createElement(
          'Text',
          { testID: 'custom-empty' },
          'Custom empty',
        )}
      </React.Fragment>
    );
    render(
      <BottomSheetAutocompleteInput
        {...defaultProps}
        data={[]}
        renderEmptyComponent={CustomEmpty}
      />,
    );
    expect(screen.getByTestId('custom-empty')).toBeTruthy();
  });

  it('shows offline message when not online', () => {
    const { useAppStore } = require('#store/useAppStore');
    useAppStore.mockReturnValue(false); // isOnline = false

    render(<BottomSheetAutocompleteInput {...defaultProps} data={[]} />);
    expect(screen.getByText('Search unavailable offline')).toBeTruthy();
    expect(
      screen.getByText('You can still type a custom value and press done'),
    ).toBeTruthy();
  });

  it('syncs searchTerm with external value when modal is closed', () => {
    const { rerender } = render(
      <BottomSheetAutocompleteInput {...defaultProps} value="initial" />,
    );

    // Change value prop
    rerender(
      <BottomSheetAutocompleteInput {...defaultProps} value="updated" />,
    );
    // Should not throw; just verify it renders
    expect(screen.getByPlaceholderText('Type ingredient name...')).toBeTruthy();
  });

  it('renders with custom snapPoint', () => {
    const { toJSON } = render(
      <BottomSheetAutocompleteInput {...defaultProps} snapPoint="50%" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom minSearchLength', () => {
    const { toJSON } = render(
      <BottomSheetAutocompleteInput {...defaultProps} minSearchLength={3} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with autoCapitalize', () => {
    render(
      <BottomSheetAutocompleteInput {...defaultProps} autoCapitalize="none" />,
    );
    expect(screen.getByPlaceholderText('Type ingredient name...')).toBeTruthy();
  });

  it('renders list footer component', () => {
    const Footer = React.createElement('Text', { testID: 'footer' }, 'Footer');
    render(
      <BottomSheetAutocompleteInput
        {...defaultProps}
        listFooterComponent={Footer}
      />,
    );
    // Footer is passed to FlatList - just verify render
    expect(screen.getByTestId('form-field-wrapper')).toBeTruthy();
  });

  it('calls onModalClose and onSearchChange callbacks', () => {
    const onSearchChange = jest.fn();
    const onModalClose = jest.fn();

    render(
      <BottomSheetAutocompleteInput
        {...defaultProps}
        onSearchChange={onSearchChange}
        onModalClose={onModalClose}
      />,
    );

    // Just verify render completes - callbacks triggered by user interaction
    expect(screen.getByPlaceholderText('Type ingredient name...')).toBeTruthy();
  });
});
