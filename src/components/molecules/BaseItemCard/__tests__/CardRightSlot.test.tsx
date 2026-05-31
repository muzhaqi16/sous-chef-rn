'use no memo';
import React from 'react';
import { Text } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { CardRightSlot } from '../CardRightSlot';
import type { CardRightSlotProps } from '../types';

jest.mock('#utils/iconUtils', () => ({
  Icon: ({
    name,
  }: React.ComponentProps<typeof import('#utils/iconUtils').Icon>) => {
    const { Text: RNText } = require('react-native');
    return require('react').createElement(RNText, null, `icon-${name}`);
  },
}));

describe('CardRightSlot', () => {
  it('renders primary and secondary meta text', () => {
    render(<CardRightSlot type="meta" primary="$4.99" secondary="per unit" />);
    expect(screen.getByText('$4.99')).toBeTruthy();
    expect(screen.getByText('per unit')).toBeTruthy();
  });

  it('renders tertiary meta text', () => {
    render(
      <CardRightSlot type="meta" primary="$4.99" tertiary="expires soon" />,
    );
    expect(screen.getByText('expires soon')).toBeTruthy();
  });

  it('renders counter with quantity', () => {
    render(
      <CardRightSlot
        type="counter"
        quantity={5}
        onIncrement={jest.fn()}
        onDecrement={jest.fn()}
      />,
    );
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders counter unit label', () => {
    render(
      <CardRightSlot
        type="counter"
        quantity={3}
        unit="pcs"
        onIncrement={jest.fn()}
        onDecrement={jest.fn()}
      />,
    );
    expect(screen.getByText('pcs')).toBeTruthy();
  });

  it('calls onIncrement when plus button is pressed', async () => {
    const user = userEvent.setup();
    const onIncrement = jest.fn();
    render(
      <CardRightSlot
        type="counter"
        quantity={2}
        onIncrement={onIncrement}
        onDecrement={jest.fn()}
      />,
    );
    await user.press(screen.getByText('icon-add'));
    expect(onIncrement).toHaveBeenCalled();
  });

  it('renders drag handle when type is dragHandle', () => {
    render(<CardRightSlot type="dragHandle" onDrag={jest.fn()} />);
    expect(screen.getByText('icon-reorder-three')).toBeTruthy();
  });

  it('renders custom children when type is custom', () => {
    render(
      <CardRightSlot type="custom">
        <Text>Custom right</Text>
      </CardRightSlot>,
    );
    expect(screen.getByText('Custom right')).toBeTruthy();
  });

  it('falls back to meta when no type specified', () => {
    // Intentionally omit `type` to exercise the runtime fallback branch.
    const propsWithoutType: Omit<CardRightSlotProps, 'type'> & {
      type?: CardRightSlotProps['type'];
    } = { type: undefined, primary: 'Fallback' };
    render(<CardRightSlot {...(propsWithoutType as CardRightSlotProps)} />);
    expect(screen.getByText('Fallback')).toBeTruthy();
  });
});
