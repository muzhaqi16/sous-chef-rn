'use no memo';
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  userEvent,
} from '@testing-library/react-native';
import { PurchaseAmountSheet } from '../PurchaseAmountSheet';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';

type PurchaseAmountSheetProps = React.ComponentProps<
  typeof PurchaseAmountSheet
>;
type PurchaseAmountSheetItem = NonNullable<PurchaseAmountSheetProps['item']>;

interface ChildrenProps {
  children?: React.ReactNode;
}

jest.mock('#hooks/useStandardBottomSheet', () => ({
  // Mirrors the real return: a mock omitting `contentContainerStyle` is why the
  // sheet went so long without its bottom inset.
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: { paddingBottom: 16 },
  })),
  BottomSheetModal: ({ children }: ChildrenProps) => children,
}));

jest.mock('#components/organisms/Header', () => ({
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

  it('sizes itself to its content so the keyboard seats it', () => {
    render(<PurchaseAmountSheet {...buildProps()} />);
    const { useStandardBottomSheet } = jest.requireMock(
      '#hooks/useStandardBottomSheet',
    ) as { useStandardBottomSheet: jest.Mock };
    // A fixed detent stretches up the screen under the keyboard and pushes the
    // price field off the bottom edge; measured content seats on it instead.
    expect(useStandardBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({ snapPoints: [], enableDynamicSizing: true }),
    );
  });

  it('renders Quantity and Total price section labels', () => {
    render(<PurchaseAmountSheet {...buildProps()} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Total price')).toBeTruthy();
  });

  it('pre-fills the quantity input from requestedQuantity', () => {
    renderWithInit(buildProps());
    expect(screen.getByTestId('purchase-quantity-input').props.value).toBe('2');
  });

  it('pre-fills the price input with the estimated total (per-unit estimate × quantity)', () => {
    renderWithInit(buildProps());
    // 4.99 per unit × 2 requested
    expect(screen.getByTestId('purchase-price-input').props.value).toBe('9.98');
  });

  it('shows how the total splits per unit when the quantity is not 1', () => {
    renderWithInit(buildProps());
    // Named in the line's OWN unit — the field beside it already says "cups",
    // so a generic "per unit" reads as a different measure.
    expect(screen.getByText(/4\.99 per cups/)).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('purchase-price-input'), '3');
    expect(screen.getByText(/1\.50 per cups/)).toBeTruthy();
  });

  it('falls back to a generic unit when the line carries none', () => {
    renderWithInit(buildProps({ item: makeItem({ unitName: null }) }));
    expect(screen.getByText(/4\.99 per unit/)).toBeTruthy();
  });

  it('hides the per-unit hint at quantity 1, where it would repeat the total', () => {
    renderWithInit(buildProps());
    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '1');
    expect(screen.queryByText(/per unit/)).toBeNull();
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
    expect(onConfirm).toHaveBeenCalledWith(2, 9.98);
  });

  it('hands the entered total to onConfirm as typed — no per-unit maths here', async () => {
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
    expect(onConfirm).toHaveBeenCalledWith(2, 9.98);
  });

  it('cancels via the header close button', () => {
    const onClose = jest.fn();
    render(<PurchaseAmountSheet {...buildProps({ onClose })} />);
    fireEvent.press(screen.getByTestId('header-close'));
    expect(onClose).toHaveBeenCalled();
  });

  // No coercion case here on purpose: an empty field is refused on the field,
  // not passed through as `onConfirm(0, 9.98)`. See "an unusable quantity is
  // refused, not substituted" below.

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
    // 1.25 per unit × 5 requested
    expect(screen.getByTestId('purchase-price-input').props.value).toBe('6.25');
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

describe('an unusable quantity is refused, not substituted', () => {
  /**
   * `parsedQty ?? 0` sends an empty field through as a real quantity. Zero is
   * a legitimate number downstream, and `unitPriceFromTotal`'s zero-guard
   * returns the total UN-divided — so the server computes `purchasedPrice x 0`
   * and records the purchase at quantity 0 for nothing, silently discarding the
   * amount the shopper typed.
   */
  it('does not confirm when the quantity is cleared', () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));

    // The input has `selectTextOnFocus`, so tapping it selects the pre-filled
    // value and one backspace empties it. This is the realistic path in.
    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '');
    fireEvent.press(screen.getByTestId('header-action-0'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not confirm when the quantity cannot be parsed', () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));

    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), 'abc');
    fireEvent.press(screen.getByTestId('header-action-0'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not confirm at quantity zero', () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));

    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '0');
    fireEvent.press(screen.getByTestId('header-action-0'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('reports the problem on the field, not through an alert', () => {
    renderWithInit(buildProps());
    expect(screen.queryByTestId('purchase-quantity-error')).toBeNull();

    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '');

    expect(screen.getByTestId('purchase-quantity-error')).toBeTruthy();
    // The field stays on screen and editable — a modal would cover the form and,
    // once dismissed, could not say which field it meant.
    expect(screen.getByTestId('purchase-quantity-input')).toBeTruthy();
  });

  it('clears the message and confirms once the quantity is usable again', () => {
    const onConfirm = jest.fn();
    renderWithInit(buildProps({ onConfirm }));

    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '');
    fireEvent.changeText(screen.getByTestId('purchase-quantity-input'), '4');

    expect(screen.queryByTestId('purchase-quantity-error')).toBeNull();
    fireEvent.press(screen.getByTestId('header-action-0'));
    expect(onConfirm).toHaveBeenCalledWith(4, 9.98);
  });
});
