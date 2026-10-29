import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QuantityInputFeedback } from '../QuantityInputFeedback';

const cups = (quantity: number) => ({
  quantity,
  unit: { symbol: 'cup' },
  displayAsFraction: true,
});

const props = {
  available: cups(2),
  consumeUnit: { symbol: 'cup' },
  isConvertedUnit: false,
  previewText: null,
  previewLoading: false,
  conversionConfidence: null,
  commonFractions: null,
  onFractionSelect: jest.fn(),
};

describe('QuantityInputFeedback', () => {
  it('renders the remaining quantity as a cooking fraction', () => {
    render(<QuantityInputFeedback {...props} remaining={cups(1.25)} />);
    expect(screen.getByText('Remaining: 1 1/4 cup')).toBeTruthy();
  });

  it('rounds the available quantity to three decimals when the input exceeds it', () => {
    render(
      <QuantityInputFeedback
        {...props}
        remaining={cups(-1)}
        available={cups(177.4412)}
      />,
    );
    expect(screen.getByText('Exceeds available (177.441 cup)')).toBeTruthy();
  });

  it('names each amount in its own unit: what is left in pieces, the stock in dozens', () => {
    const dozens = {
      quantity: 3,
      unit: { symbol: 'doz' },
      displayAsFraction: null,
    };
    const { rerender } = render(
      <QuantityInputFeedback
        {...props}
        consumeUnit={{ symbol: 'pc' }}
        available={dozens}
        remaining={{
          quantity: 11,
          unit: { symbol: 'pc' },
          displayAsFraction: false,
        }}
      />,
    );
    expect(screen.getByText('Remaining: 11 pc')).toBeTruthy();

    rerender(
      <QuantityInputFeedback
        {...props}
        consumeUnit={{ symbol: 'pc' }}
        available={dozens}
        remaining={{
          quantity: -4,
          unit: { symbol: 'pc' },
          displayAsFraction: false,
        }}
      />,
    );
    expect(screen.getByText('Exceeds available (3 doz)')).toBeTruthy();
  });
});
