'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { IngredientMatchRow } from '../IngredientMatchRow';

jest.mock('#hooks/recipe/useRecipeIngredientMatching', () => ({
  getAvailabilityStatus: jest.fn((match: any) => {
    if (match.matchedPantryItem) return 'available';
    return 'missing';
  }),
}));

describe('IngredientMatchRow', () => {
  const makeMatch = (name: string, overrides = {}) => ({
    match: {
      ingredient: { id: 'i1', name, isOptional: false },
      matchedPantryItem: null,
      suggestedUnit: null,
      ...overrides,
    },
    adjustedQuantity: 2,
    isIncluded: true,
  });

  const defaultProps: any = {
    editableMatch: makeMatch('Sugar'),
    index: 0,
    onUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ingredient name', () => {
    render(<IngredientMatchRow {...defaultProps} />);
    expect(screen.getByText('Sugar')).toBeTruthy();
  });

  it('renders quantity input with value', () => {
    render(<IngredientMatchRow {...defaultProps} />);
    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  it('renders status badge', () => {
    render(<IngredientMatchRow {...defaultProps} />);
    expect(screen.getByText('Missing')).toBeTruthy();
  });

  it('renders switch for include/exclude', () => {
    render(<IngredientMatchRow {...defaultProps} />);
    // The Switch component is a native component
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeTruthy();
  });

  it('renders Optional badge for optional ingredients', () => {
    const optionalMatch = makeMatch('Garnish');
    optionalMatch.match.ingredient.isOptional = true;
    render(
      <IngredientMatchRow {...defaultProps} editableMatch={optionalMatch} />,
    );
    expect(screen.getByText('Optional')).toBeTruthy();
  });

  it('renders matched pantry item info', () => {
    const matched = makeMatch('Sugar', {
      matchedPantryItem: {
        itemName: 'White Sugar',
        quantity: 5,
        unit: { symbol: 'cups' },
      },
    });
    render(<IngredientMatchRow {...defaultProps} editableMatch={matched} />);
    expect(screen.getByText(/White Sugar/)).toBeTruthy();
  });

  it('renders suggested unit symbol', () => {
    const withUnit = makeMatch('Flour', { suggestedUnit: { symbol: 'cups' } });
    render(<IngredientMatchRow {...defaultProps} editableMatch={withUnit} />);
    expect(screen.getByText('cups')).toBeTruthy();
  });

  it('renders Qty label', () => {
    render(<IngredientMatchRow {...defaultProps} />);
    expect(screen.getByText('Qty:')).toBeTruthy();
  });
});
