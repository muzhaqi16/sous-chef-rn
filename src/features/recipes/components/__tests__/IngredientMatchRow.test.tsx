'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type {
  getAvailabilityStatus as getAvailabilityStatusFn,
  EditableMatch,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { IngredientMatchRow } from '../IngredientMatchRow';

jest.mock('#features/recipes/hooks/useRecipeIngredientMatching', () => ({
  getAvailabilityStatus: jest.fn(
    (match: Parameters<typeof getAvailabilityStatusFn>[0]) => {
      if (match.matchedPantryItem) return 'available';
      return 'missing';
    },
  ),
}));

describe('IngredientMatchRow', () => {
  // Minimal structural fixtures: the strict `EditableMatch` type requires
  // fully-materialized masked-fragment shapes (RecipeIngredientFragment, full
  // RecipeIngredientMatch, typed Unit) that these tests intentionally omit.
  const makeMatch = (
    name: string,
    overrides: Partial<EditableMatch['match']> & {
      ingredient?: Partial<EditableMatch['ingredient']>;
    } = {},
  ): EditableMatch => {
    const matchDefaults: EditableMatch['match'] = {
      __typename: 'RecipeIngredientMatch',
      isAvailable: false,
      matchConfidence: 0,
      availableQuantity: 0,
      suggestedQuantity: 2,
      shortfall: null,
      ingredient: { __typename: 'RecipeIngredient', id: 'i1' },
      suggestedUnit: null,
      matchedPantryItem: null,
    };

    const ingredientDefaults: EditableMatch['ingredient'] = {
      __typename: 'RecipeIngredient',
      id: 'i1',
      name,
      quantity: 0,
      image: null,
      isOptional: false,
      notes: null,
      preparation: null,
      sortOrder: 0,
      section: null,
      item: null,
      unit: null,
    };

    const match: EditableMatch['match'] = { ...matchDefaults, ...overrides };
    const ingredient: EditableMatch['ingredient'] = {
      ...ingredientDefaults,
      ...(overrides.ingredient ?? {}),
    };

    return {
      match,
      ingredient,
      adjustedQuantity: 2,
      adjustedUnitId: null,
      isIncluded: true,
    };
  };

  const defaultProps: {
    editableMatch: EditableMatch;
    index: number;
    onUpdate: jest.Mock;
  } = {
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
    optionalMatch.ingredient.isOptional = true;
    render(
      <IngredientMatchRow {...defaultProps} editableMatch={optionalMatch} />,
    );
    expect(screen.getByText('Optional')).toBeTruthy();
  });

  it('renders matched pantry item info', () => {
    const matched = makeMatch('Sugar', {
      matchedPantryItem: {
        __typename: 'PantryItem',
        id: 'p1',
        itemName: 'White Sugar',
        quantity: 5,
        unit: { __typename: 'Unit', id: 'u1', name: 'cup', symbol: 'cups' },
      },
    });
    render(<IngredientMatchRow {...defaultProps} editableMatch={matched} />);
    expect(screen.getByText(/White Sugar/)).toBeTruthy();
  });

  it('renders suggested unit symbol', () => {
    const withUnit = makeMatch('Flour', {
      suggestedUnit: {
        __typename: 'Unit',
        id: 'u2',
        name: 'cup',
        symbol: 'cups',
      },
    });
    render(<IngredientMatchRow {...defaultProps} editableMatch={withUnit} />);
    expect(screen.getByText('cups')).toBeTruthy();
  });

  it('renders Qty label', () => {
    render(<IngredientMatchRow {...defaultProps} />);
    expect(screen.getByText('Qty:')).toBeTruthy();
  });
});
