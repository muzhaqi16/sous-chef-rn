'use no memo';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { GetShoppingListsLiteDocument } from '../GenerateShoppingListSheet.generated';
import { GenerateShoppingListSheet } from '../GenerateShoppingListSheet';

function listsMock() {
  return recordMock(GetShoppingListsLiteDocument, {
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        edges: [
          {
            __typename: 'ShoppingListEdge',
            cursor: 'c1',
            node: {
              __typename: 'ShoppingList',
              id: 'sl-1',
              name: 'Weekly Groceries',
              totalItems: 10,
            },
          },
          {
            __typename: 'ShoppingListEdge',
            cursor: 'c2',
            node: {
              __typename: 'ShoppingList',
              id: 'sl-2',
              name: 'Party Supplies',
              totalItems: 5,
            },
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  }).mock;
}

function renderSheet(props: any = {}) {
  return renderWithApollo(
    <GenerateShoppingListSheet {...defaultProps} {...props} />,
    { operationMocks: [listsMock()] },
  );
}

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: any) => children,
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/base/BaseSwitch', () => ({
  BaseSwitch: ({ value, onValueChange }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="base-switch" onPress={() => onValueChange(!value)}>
        <Text>{value ? 'ON' : 'OFF'}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({
    title,
    onCancel,
    onConfirm,
    confirmLabel,
    confirmDisabled,
  }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="bottom-sheet-header">
        <Text>{title}</Text>
        <Pressable onPress={onCancel} testID="cancel-button">
          <Text>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          testID="confirm-button"
          disabled={confirmDisabled}
        >
          <Text>{confirmLabel}</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('#components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({ label, value, onChangeText, placeholder }: any) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          testID={`input-${label}`}
        />
      </View>
    );
  },
}));

jest.mock('#/apollo/links/tokenScheduler');

jest.mock('#/apollo/links/refreshToken');

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onGenerate: jest.fn(),
  loading: false,
};

describe('GenerateShoppingListSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header title', () => {
    renderSheet();
    expect(screen.getByText('Generate Shopping List')).toBeTruthy();
  });

  it('renders the check pantry toggle', () => {
    renderSheet();
    expect(screen.getByText('Check pantry availability')).toBeTruthy();
    expect(
      screen.getByText('Deduct items you already have in your pantry'),
    ).toBeTruthy();
  });

  it('renders the destination mode selector', () => {
    renderSheet();
    expect(screen.getByText('Destination')).toBeTruthy();
    expect(screen.getByText('New List')).toBeTruthy();
    expect(screen.getByText('Existing List')).toBeTruthy();
  });

  it('shows the generate confirm button', () => {
    renderSheet();
    expect(screen.getByText('Generate')).toBeTruthy();
  });

  it('shows Generating... when loading', () => {
    renderSheet({ loading: true });
    expect(screen.getByText('Generating...')).toBeTruthy();
    expect(screen.getByText('Generating shopping list...')).toBeTruthy();
  });

  it('shows home sharing info when homeName is provided', () => {
    renderSheet({ homeName: 'My Home' });
    expect(
      screen.getByText('The shopping list will be shared with My Home'),
    ).toBeTruthy();
  });

  it('does not show home sharing info when homeName is not provided', () => {
    renderSheet();
    expect(screen.queryByText(/shared with/)).toBeNull();
  });

  it('shows custom name input in "new" mode', () => {
    renderSheet();
    expect(screen.getByText('List Name (optional)')).toBeTruthy();
  });

  it('shows existing lists when switching to "existing" mode', async () => {
    renderSheet();
    fireEvent.press(screen.getByText('Existing List'));
    expect(screen.getByText('Select a list')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('Weekly Groceries')).toBeTruthy(),
    );
    expect(screen.getByText('Party Supplies')).toBeTruthy();
  });

  it('calls onGenerate when confirm button is pressed', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onGenerate).toHaveBeenCalledWith({
      checkPantry: true,
      name: undefined,
      shoppingListId: undefined,
    });
  });
});
