'use no memo';
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  userEvent,
} from '@testing-library/react-native';
import { PurchaseAmountSheet } from '../PurchaseAmountSheet';
import type { HeaderAction } from '#/components/atoms/HeaderActionIcon';

type PurchaseAmountSheetProps = React.ComponentProps<
  typeof PurchaseAmountSheet
>;
type PurchaseAmountSheetItem = NonNullable<PurchaseAmountSheetProps['item']>;

interface ChildrenProps {
  children?: React.ReactNode;
}

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
  })),
  BottomSheetModal: ({ children }: ChildrenProps) => children,
}));

jest.mock('#/components/molecules/Header', () => ({
  Header: ({
    title,
    onClose,
    rightActions,
  }: {
    title?: string;
    onClose?: () => void;
    rightActions?: HeaderAction[];
  }) => {
    const { Text, View, Pressable } = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        <Pressable testID="header-close" onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
        {rightActions?.map((action: HeaderAction, i: number) => (
          <Pressable
            key={i}
            testID={`header-action-${i}`}
            // Mirror HeaderActionIcon: a disabled action ignores presses.
            onPress={action.disabled ? undefined : action.onPress}
            disabled={action.disabled}
          >
            <Text>{action.loading ? 'Loading...' : 'Confirm'}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

const makeItem = (
  overrides: Partial<PurchaseAmountSheetItem> = {},
): PurchaseAmountSheetItem => ({
  id: 'item-1',
  itemName: 'Milk',
  requestedQuantity: 2,
  unitName: 'cups',
  estimatedPrice: 4.99,
  ...overrides,
});

const buildProps = (
  overrides: Partial<PurchaseAmountSheetProps> = {},
): PurchaseAmountSheetProps => ({
  visible: true,
  item: makeItem(),
  onClose: jest.fn(),
  onConfirm: jest.fn(),
  loading: false,
  ...overrides,
});

/**
 * The component seeds its inputs only when `visible` transitions false -> true
 * (or the item id changes), so render hidden first, then make it visible.
 */
const renderWithInit = (props: PurchaseAmountSheetProps) => {
  const result = render(<PurchaseAmountSheet {...props} visible={false} />);
  result.rerender(<PurchaseAmountSheet {...props} visible={true} />);
  return result;
};

describe('PurchaseAmountSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the static title and the item name inside the sheet', () => {
    render(<PurchaseAmountSheet {...buildProps()} />);
    expect(screen.getByText('Mark Purchased')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders Quantity and Price section labels', () => {
    render(<PurchaseAmountSheet {...buildProps()} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Price')).toBeTruthy();
  });

  it('pre-fills the quantity input from requestedQuantity', () => {
    renderWithInit(buildProps());
    expect(screen.getByTestId('purchase-quantity-input').props.value).toBe('2');
  });

  it('pre-fills the price input from estimatedPrice', () => {
    renderWithInit(buildProps());
    expect(screen.getByTestId('purchase-price-input').props.value).toBe('4.99');
  });

  it('renders the unit suffix when unitName is present', () => {
    render(<PurchaseAmountSheet {...buildProps()} />);
    expect(screen.getByText('cups')).toBeTruthy();
  });

  it('leaves the price input empty when estimatedPrice is null', () => {
    renderWithInit(buildProps({ item: makeItem({ estimatedPrice: null }) }));
    expect(screen.getByTestId('purchase-price-input').props.value).toBe('');
  });

  it('confirms with the pre-filled values', async () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));
    fireEvent.press(screen.getByTestId('header-action-0'));
    expect(onConfirm).toHaveBeenCalledWith(2, 4.99);
  });

  it('confirms with edited quantity and price', async () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));
    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '3');
    fireEvent.changeText(screen.getByTestId('purchase-price-input'), '7.50');
    fireEvent.press(screen.getByTestId('header-action-0'));
    expect(onConfirm).toHaveBeenCalledWith(3, 7.5);
  });

  it('passes null price to onConfirm when the price input is cleared', () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));
    fireEvent.changeText(screen.getByTestId('purchase-price-input'), '');
    fireEvent.press(screen.getByTestId('header-action-0'));
    expect(onConfirm).toHaveBeenCalledWith(2, null);
  });

  it('confirms via the header checkmark action', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));
    await user.press(screen.getByTestId('header-action-0'));
    expect(onConfirm).toHaveBeenCalledWith(2, 4.99);
  });

  it('cancels via the header close button', () => {
    const onClose = jest.fn();
    render(<PurchaseAmountSheet {...buildProps({ onClose })} />);
    fireEvent.press(screen.getByTestId('header-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('treats an empty quantity as 0 on confirm', () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));
    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '');
    fireEvent.press(screen.getByTestId('header-action-0'));
    expect(onConfirm).toHaveBeenCalledWith(0, 4.99);
  });

  it('re-seeds inputs when the item id changes', () => {
    const props = buildProps();
    const { rerender } = renderWithInit(props);
    expect(screen.getByTestId('purchase-quantity-input').props.value).toBe('2');
    rerender(
      <PurchaseAmountSheet
        {...props}
        item={makeItem({
          id: 'item-2',
          requestedQuantity: 5,
          estimatedPrice: 1.25,
        })}
      />,
    );
    expect(screen.getByTestId('purchase-quantity-input').props.value).toBe('5');
    expect(screen.getByTestId('purchase-price-input').props.value).toBe('1.25');
  });

  it('does not confirm via the header checkmark while loading', () => {
    const onConfirm = jest.fn();
    render(
      <PurchaseAmountSheet {...buildProps({ loading: true, onConfirm })} />,
    );
    fireEvent.press(screen.getByTestId('header-action-0'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
