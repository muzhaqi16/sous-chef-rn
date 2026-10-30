import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { ParseIngredientLinesDocument } from '#features/recipes/hooks/useIngredientPaste.generated';
import { pastedLines } from '#features/recipes/utils/pastedIngredients';
import { PasteIngredientsSheet } from '../PasteIngredientsSheet';

jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.mocked(useIsApiUnavailable).mockReturnValue(false);
});

function renderSheet(room: number) {
  const parse = recordMock(ParseIngredientLinesDocument, {
    dataFor: vars => ({
      parseIngredientLines: {
        lines: (vars.input as { lines: string[] }).lines.map(line => ({
          originalText: line,
        })),
      },
    }),
  });
  const onPasted = jest.fn();
  const onDismiss = jest.fn();
  renderWithApollo(
    <PasteIngredientsSheet
      visible
      room={room}
      onPasted={onPasted}
      onDismiss={onDismiss}
    />,
    { operationMocks: [parse.mock] },
  );
  return { onPasted, onDismiss };
}

const paste = (text: string) =>
  fireEvent.changeText(
    screen.getByTestId(recipesTestIDs.pasteIngredientsInput),
    text,
  );

describe('PasteIngredientsSheet', () => {
  it('adds a row per pasted line, keeping each line as written', async () => {
    const { onPasted, onDismiss } = renderSheet(10);

    paste('2 cups flour\n\nsalt, to taste');
    fireEvent.press(screen.getByTestId(recipesTestIDs.pasteIngredientsAdd));

    await drainTimers();
    expect(onPasted).toHaveBeenCalledTimes(1);
    expect(onPasted.mock.calls[0][0]).toEqual([
      expect.objectContaining({ originalText: '2 cups flour' }),
      expect.objectContaining({ originalText: 'salt, to taste' }),
    ]);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('holds only as many lines as the recipe has room for, and says so', () => {
    renderSheet(3);

    paste('a\nb\nc\nd\ne');

    const field = screen.getByTestId(recipesTestIDs.pasteIngredientsInput);
    expect(pastedLines(field.props.value as string)).toEqual(['a', 'b', 'c']);
    expect(
      screen.getByText('3 more ingredients fit in this recipe.'),
    ).toBeTruthy();
    expect(screen.getByText('Add 3 ingredients')).toBeTruthy();
  });

  it('cannot read lines while the API is unavailable, and says why', () => {
    jest.mocked(useIsApiUnavailable).mockReturnValue(true);
    renderSheet(10);

    paste('2 cups flour');

    expect(
      screen.getByText('Reading pasted ingredients needs a connection.'),
    ).toBeTruthy();
    expect(
      screen.getByTestId(recipesTestIDs.pasteIngredientsAdd).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('says the recipe is full instead of offering a field', () => {
    renderSheet(0);

    expect(
      screen.getByText('This recipe holds as many ingredients as it can.'),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(recipesTestIDs.pasteIngredientsInput),
    ).toBeNull();
  });
});
