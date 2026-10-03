'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  getAvailabilityStatus,
  type EditableMatch,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { IngredientMatchRow } from '../IngredientMatchRow';

jest.mock('#features/recipes/hooks/useRecipeIngredientMatching', () => ({
  getAvailabilityStatus: jest.fn(
    (match: Parameters<typeof getAvailabilityStatus>[0]) => {
      if (match.matchedPantryItem) return 'available';
      return 'missing';
    },
  ),
}));

type ShownAmount = NonNullable<
  EditableMatch['match']['matchedPantryItem']
>['displayAmount'];

const shown = (quantity: number, symbol: string): ShownAmount => ({
  __typename: 'DisplayAmount',
  quantity,
  unit: { __typename: 'Unit', id: symbol, symbol },
});

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
      alternativeMatches: [],
    };

    const ingredientDefaults: EditableMatch['ingredient'] = {
      __typename: 'RecipeIngredient',
      id: 'i1',
      name,
      quantity: 0,
      estimatedPrice: null,
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
      stackOptions: match.matchedPantryItem
        ? [match.matchedPantryItem, ...match.alternativeMatches]
        : [],
      selectedStack: match.matchedPantryItem,
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

  type Stack = NonNullable<EditableMatch['selectedStack']>;
  const stack = (id: string, itemName: string, amount: number): Stack => ({
    __typename: 'PantryItem',
    id,
    itemName,
    unit: { __typename: 'Unit', id: 'u-ml', name: 'milliliter', symbol: 'mL' },
    displayAmount: shown(amount, 'mL'),
  });

  // A name-only match ("olives" finding "Kalamata Olives") is offered, not
  // deducted, until the user turns it on.
  it('asks before deducting a stack matched by name only', () => {
    jest.mocked(getAvailabilityStatus).mockReturnValueOnce('unsure');
    const unsure = {
      ...makeMatch('Olives', {
        matchConfidence: 0.7,
        matchedPantryItem: stack('p1', 'Kalamata Olives', 250),
      }),
      isIncluded: false,
    };
    render(<IngredientMatchRow {...defaultProps} editableMatch={unsure} />);

    expect(screen.getByText('Check')).toBeTruthy();
    expect(
      screen.getByText(
        'Matched by name only. Turn it on if this is the right item.',
      ),
    ).toBeTruthy();
  });

  // "Olive oil" is served by the plain bottle and by the extra virgin one
  // under it; the user picks which one the cook draws on.
  it('offers every stack that serves the ingredient and takes the one picked', () => {
    const onUpdate = jest.fn();
    const evoo = stack('p2', 'Extra virgin olive oil', 500);
    const match = makeMatch('Olive oil', {
      matchConfidence: 1,
      matchedPantryItem: stack('p1', 'Olive oil', 1000),
      alternativeMatches: [evoo],
    });
    render(
      <IngredientMatchRow
        {...defaultProps}
        editableMatch={match}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.press(screen.getByText('Extra virgin olive oil (500 mL)'));

    expect(onUpdate).toHaveBeenCalledWith(0, {
      selectedStack: evoo,
      isIncluded: true,
    });
  });

  // The server's availability describes its own pick, not a stack the user chose.
  it('drops the availability badge once another stack is picked', () => {
    const evoo = stack('p2', 'Extra virgin olive oil', 500);
    const match = {
      ...makeMatch('Olive oil', {
        matchConfidence: 1,
        matchedPantryItem: stack('p1', 'Olive oil', 1000),
        alternativeMatches: [evoo],
      }),
      selectedStack: evoo,
    };
    render(<IngredientMatchRow {...defaultProps} editableMatch={match} />);

    expect(screen.queryByText('Available')).toBeNull();
  });

  it('renders matched pantry item info', () => {
    const matched = makeMatch('Sugar', {
      matchedPantryItem: {
        __typename: 'PantryItem',
        id: 'p1',
        itemName: 'White Sugar',
        unit: { __typename: 'Unit', id: 'u1', name: 'cup', symbol: 'cups' },
        displayAmount: shown(5, 'cups'),
      },
    });
    render(<IngredientMatchRow {...defaultProps} editableMatch={matched} />);
    expect(screen.getByText(/White Sugar/)).toBeTruthy();
  });

  it('renders the matched pantry quantity as a cooking fraction', () => {
    const matched = makeMatch('Sugar', {
      matchedPantryItem: {
        __typename: 'PantryItem',
        id: 'p1',
        itemName: 'White Sugar',
        unit: { __typename: 'Unit', id: 'u1', name: 'cup', symbol: 'cups' },
        displayAmount: shown(1.25, 'cups'),
      },
    });
    render(<IngredientMatchRow {...defaultProps} editableMatch={matched} />);
    expect(screen.getByText(/1 1\/4 cups/)).toBeTruthy();
  });

  it('rounds a matched pantry quantity no fraction fits to three decimals', () => {
    const matched = makeMatch('Milk', {
      matchedPantryItem: {
        __typename: 'PantryItem',
        id: 'p1',
        itemName: 'Milk',
        unit: {
          __typename: 'Unit',
          id: 'u1',
          name: 'millilitre',
          symbol: 'mL',
        },
        displayAmount: shown(177.4412, 'mL'),
      },
    });
    render(<IngredientMatchRow {...defaultProps} editableMatch={matched} />);
    expect(screen.getByText(/177\.441 mL/)).toBeTruthy();
  });

  it('names the matched stack as the pantry shows it, in dozens', () => {
    const matched = makeMatch('Eggs', {
      matchedPantryItem: {
        __typename: 'PantryItem',
        id: 'p1',
        itemName: 'Eggs',
        unit: { __typename: 'Unit', id: 'pc', name: 'piece', symbol: 'pc' },
        displayAmount: shown(3, 'doz'),
      },
    });
    render(<IngredientMatchRow {...defaultProps} editableMatch={matched} />);
    expect(screen.getByText('Matched: Eggs (3 doz available)')).toBeTruthy();
  });

  it('seeds the decimal-pad quantity input rounded to three decimals, never a fraction', () => {
    render(
      <IngredientMatchRow
        {...defaultProps}
        editableMatch={{ ...makeMatch('Milk'), adjustedQuantity: 0.33333334 }}
      />,
    );
    expect(screen.getByDisplayValue('0.333')).toBeTruthy();
  });

  it('keeps a half-typed decimal in the field while the quantity updates', () => {
    const onUpdate = jest.fn();
    const editableMatch = { ...makeMatch('Milk'), adjustedQuantity: 1 };
    const { rerender } = render(
      <IngredientMatchRow
        {...defaultProps}
        onUpdate={onUpdate}
        editableMatch={editableMatch}
      />,
    );

    fireEvent.changeText(screen.getByDisplayValue('1'), '1.');
    expect(onUpdate).toHaveBeenLastCalledWith(0, { adjustedQuantity: 1 });
    rerender(
      <IngredientMatchRow
        {...defaultProps}
        onUpdate={onUpdate}
        editableMatch={{ ...editableMatch, adjustedQuantity: 1 }}
      />,
    );
    expect(screen.getByDisplayValue('1.')).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue('1.'), '1.5');
    expect(onUpdate).toHaveBeenLastCalledWith(0, { adjustedQuantity: 1.5 });
  });

  it('clears the quantity when the field is emptied, so nothing is deducted', () => {
    const onUpdate = jest.fn();
    // The sheet owns the match, so the row's update lands in the same render.
    const Sheet = () => {
      const [editableMatch, setEditableMatch] = React.useState({
        ...makeMatch('Flour'),
        adjustedQuantity: 2,
      });
      return (
        <IngredientMatchRow
          editableMatch={editableMatch}
          index={0}
          onUpdate={(index, updates) => {
            onUpdate(index, updates);
            setEditableMatch(current => ({ ...current, ...updates }));
          }}
        />
      );
    };
    render(<Sheet />);

    fireEvent.changeText(screen.getByDisplayValue('2'), '');

    expect(onUpdate).toHaveBeenLastCalledWith(0, { adjustedQuantity: 0 });
    expect(screen.queryByDisplayValue('2')).toBeNull();
    expect(screen.queryByDisplayValue('0')).toBeNull();
  });

  it('clears the quantity when the field holds no number', () => {
    const onUpdate = jest.fn();
    render(
      <IngredientMatchRow
        {...defaultProps}
        onUpdate={onUpdate}
        editableMatch={{ ...makeMatch('Flour'), adjustedQuantity: 2 }}
      />,
    );

    fireEvent.changeText(screen.getByDisplayValue('2'), 'abc');

    expect(onUpdate).toHaveBeenLastCalledWith(0, { adjustedQuantity: 0 });
  });

  it('reseeds the field when the quantity changes from outside it', () => {
    const editableMatch = { ...makeMatch('Milk'), adjustedQuantity: 1 };
    const { rerender } = render(
      <IngredientMatchRow {...defaultProps} editableMatch={editableMatch} />,
    );
    rerender(
      <IngredientMatchRow
        {...defaultProps}
        editableMatch={{ ...editableMatch, adjustedQuantity: 2.5 }}
      />,
    );
    expect(screen.getByDisplayValue('2.5')).toBeTruthy();
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
