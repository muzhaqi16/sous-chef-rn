import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QuantityInputFeedback } from '../QuantityInputFeedback';

const props = {
  availableInUnit: 2,
  activeUnitSymbol: 'cup',
  isConvertedUnit: false,
  previewText: null,
  previewLoading: false,
  conversionConfidence: null,
  commonFractions: null,
  onFractionSelect: jest.fn(),
};

describe('QuantityInputFeedback', () => {
  it('renders the remaining quantity as a cooking fraction', () => {
    render(<QuantityInputFeedback {...props} remaining={1.25} />);
    expect(screen.getByText('Remaining: 1 1/4 cup')).toBeTruthy();
  });

  it('rounds the available quantity to three decimals when the input exceeds it', () => {
    render(
      <QuantityInputFeedback
        {...props}
        remaining={-1}
        availableInUnit={177.4412}
      />,
    );
    expect(screen.getByText('Exceeds available (177.441 cup)')).toBeTruthy();
  });
});
