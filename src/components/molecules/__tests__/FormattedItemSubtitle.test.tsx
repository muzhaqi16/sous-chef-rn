'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FormattedItemSubtitle } from '../FormattedItemSubtitle';

jest.mock('#components/atoms/QuantityDisplay', () => ({
  QuantityDisplay: ({
    quantity,
    unitSymbol,
  }: {
    quantity: number | null | undefined;
    unitSymbol?: string | null;
  }) => {
    const { Text } = require('react-native');
    return require('react').createElement(
      Text,
      null,
      `${quantity}${unitSymbol ? ' ' + unitSymbol : ''}`,
    );
  },
}));

describe('FormattedItemSubtitle', () => {
  it('returns null when no data is provided', () => {
    const { toJSON } = render(<FormattedItemSubtitle />);
    expect(toJSON()).toBeNull();
  });

  it('renders quantity and weight with separator for qty > 1', () => {
    render(
      <FormattedItemSubtitle quantity={2} netWeight={100} unitSymbol="g" />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText(/100 g/)).toBeTruthy();
  });

  it('renders only weight when quantity is 1', () => {
    render(
      <FormattedItemSubtitle quantity={1} netWeight={3.2} unitSymbol="oz" />,
    );
    expect(screen.getByText(/3.2 oz/)).toBeTruthy();
  });

  it('renders only quantity with unit when no weight', () => {
    render(<FormattedItemSubtitle quantity={5} unitSymbol="cups" />);
    expect(screen.getByText(/5 cups/)).toBeTruthy();
  });

  it('renders only weight when no quantity', () => {
    render(<FormattedItemSubtitle netWeight={250} unitSymbol="ml" />);
    expect(screen.getByText(/250 ml/)).toBeTruthy();
  });

  it('renders only additional info as fallback', () => {
    render(<FormattedItemSubtitle additionalInfo="Refrigerated" />);
    expect(screen.getByText('Refrigerated')).toBeTruthy();
  });

  it('displays additional info alongside quantity and weight', () => {
    render(
      <FormattedItemSubtitle
        quantity={2}
        netWeight={100}
        unitSymbol="g"
        additionalInfo="Fresh"
      />,
    );
    expect(screen.getByText('Fresh')).toBeTruthy();
  });

  it('renders partial single item with remaining label', () => {
    render(
      <FormattedItemSubtitle
        quantity={0.5}
        initialQuantity={1}
        netWeight={50}
        unitSymbol="g"
      />,
    );
    expect(screen.getByText(/50 g/)).toBeTruthy();
  });
});
