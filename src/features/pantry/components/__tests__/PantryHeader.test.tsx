import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PantryHeader } from '../PantryHeader';
import { pantryTestIDs } from '#features/pantry/testIDs';

const RECT = { x: 1, y: 2, width: 24, height: 24 };

// The spotlight reads a native measure that the test renderer has no layout
// for; this reports a fixed rect so the wiring is what is under test.
jest.mock('#hooks/ui/useMeasuredRect', () => ({
  useMeasuredRect: (onMeasure?: (rect: typeof RECT) => void) => ({
    ref: { current: null },
    measure: () => onMeasure?.(RECT),
  }),
}));

describe('PantryHeader', () => {
  it('opens the pantry sheet from its Select pantry action', () => {
    const onSelectPantryPress = jest.fn();
    render(
      <PantryHeader
        householdName="Test Home"
        onSelectPantryPress={onSelectPantryPress}
      />,
    );
    fireEvent.press(screen.getByTestId(pantryTestIDs.selectPantryButton));
    expect(onSelectPantryPress).toHaveBeenCalledTimes(1);
  });

  it('reports where Select pantry sits, for the tutorial', () => {
    const onSelectPantryLayout = jest.fn();
    render(
      <PantryHeader
        householdName="Test Home"
        onSelectPantryPress={jest.fn()}
        onSelectPantryLayout={onSelectPantryLayout}
      />,
    );
    fireEvent(
      screen.getByTestId(pantryTestIDs.selectPantryButton).parent!.parent!,
      'layout',
    );
    expect(onSelectPantryLayout).toHaveBeenCalledWith(RECT);
  });

  it('shows no Select pantry action without a handler', () => {
    render(<PantryHeader householdName="Test Home" />);
    expect(screen.queryByTestId(pantryTestIDs.selectPantryButton)).toBeNull();
  });
});
