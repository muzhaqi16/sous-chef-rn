'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GenerateShoppingListSheet } from '../GenerateShoppingListSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
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

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetShoppingListsLite') {
      return {
        data: {
          shoppingLists: {
            edges: [
              {
                node: { id: 'sl-1', name: 'Weekly Groceries', totalItems: 10 },
              },
              { node: { id: 'sl-2', name: 'Party Supplies', totalItems: 5 } },
            ],
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      };
    }
    return { data: undefined, loading: false, error: undefined };
  }),
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
    render(<GenerateShoppingListSheet {...defaultProps} />);
    expect(screen.getByText('Generate Shopping List')).toBeTruthy();
  });

  it('renders the check pantry toggle', () => {
    render(<GenerateShoppingListSheet {...defaultProps} />);
    expect(screen.getByText('Check pantry availability')).toBeTruthy();
    expect(
      screen.getByText('Deduct items you already have in your pantry'),
    ).toBeTruthy();
  });

  it('renders the destination mode selector', () => {
    render(<GenerateShoppingListSheet {...defaultProps} />);
    expect(screen.getByText('Destination')).toBeTruthy();
    expect(screen.getByText('New List')).toBeTruthy();
    expect(screen.getByText('Existing List')).toBeTruthy();
  });

  it('shows the generate confirm button', () => {
    render(<GenerateShoppingListSheet {...defaultProps} />);
    expect(screen.getByText('Generate')).toBeTruthy();
  });

  it('shows Generating... when loading', () => {
    render(<GenerateShoppingListSheet {...defaultProps} loading={true} />);
    expect(screen.getByText('Generating...')).toBeTruthy();
    expect(screen.getByText('Generating shopping list...')).toBeTruthy();
  });

  it('shows home sharing info when homeName is provided', () => {
    render(<GenerateShoppingListSheet {...defaultProps} homeName="My Home" />);
    expect(
      screen.getByText('The shopping list will be shared with My Home'),
    ).toBeTruthy();
  });

  it('does not show home sharing info when homeName is not provided', () => {
    render(<GenerateShoppingListSheet {...defaultProps} />);
    expect(screen.queryByText(/shared with/)).toBeNull();
  });

  it('shows custom name input in "new" mode', () => {
    render(<GenerateShoppingListSheet {...defaultProps} />);
    expect(screen.getByText('List Name (optional)')).toBeTruthy();
  });

  it('shows existing lists when switching to "existing" mode', () => {
    render(<GenerateShoppingListSheet {...defaultProps} />);
    fireEvent.press(screen.getByText('Existing List'));
    expect(screen.getByText('Select a list')).toBeTruthy();
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
    expect(screen.getByText('Party Supplies')).toBeTruthy();
  });

  it('calls onGenerate when confirm button is pressed', () => {
    render(<GenerateShoppingListSheet {...defaultProps} />);
    fireEvent.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onGenerate).toHaveBeenCalledWith({
      checkPantry: true,
      name: undefined,
      shoppingListId: undefined,
    });
  });
});
