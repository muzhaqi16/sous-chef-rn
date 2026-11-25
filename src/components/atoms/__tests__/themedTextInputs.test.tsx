import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { Sheet, type SheetMode } from '#components/templates/Sheet';
import { ThemedTextInput } from '../themedComponents';

// Gorhom's keyboard handling waits for its own input's focus, so inside any
// sheet the field is gorhom's; anywhere else gorhom's throws.
describe('ThemedTextInput in a sheet', () => {
  // The suite's gorhom mock names its input, which nothing else imports.
  const { BottomSheetTextInput } = jest.requireMock<{
    BottomSheetTextInput: React.ComponentType;
  }>('@gorhom/bottom-sheet');

  it.each<SheetMode>(['view', 'form', 'action', 'list'])(
    "is gorhom's input in a %s sheet",
    mode => {
      renderWithApollo(
        <Sheet mode={mode} visible onDismiss={jest.fn()} snapPoints={['50%']}>
          <ThemedTextInput testID="input" />
        </Sheet>,
      );

      expect(screen.UNSAFE_getByType(BottomSheetTextInput)).toBeTruthy();
    },
  );

  it("is React Native's input outside one", () => {
    render(<ThemedTextInput testID="input" />);

    expect(screen.getByTestId('input')).toBeOnTheScreen();
    expect(screen.UNSAFE_queryByType(BottomSheetTextInput)).toBeNull();
  });
});

// RN's TextInput defaults to dark text, so an input whose style omits `color`
// renders what the user typed nearly invisible on the dark theme. The atom
// supplies it so no call site has to remember.
// Last wins, as RN resolves a style array.
const colorOf = (testID: string) =>
  [screen.getByTestId(testID).props.style]
    .flat(Infinity)
    .filter(Boolean)
    .map(style => (style as { color?: string }).color)
    .filter(Boolean)
    .at(-1);

describe('ThemedTextInput', () => {
  const Input = ThemedTextInput;

  it('carries a text color when the caller passes no style', () => {
    render(<Input testID="input" />);

    expect(colorOf('input')).toBeTruthy();
  });

  it('carries a text color when the caller style omits one', () => {
    render(<Input testID="input" style={{ padding: 12 }} />);

    expect(colorOf('input')).toBeTruthy();
  });

  it('lets a call site override the color', () => {
    // CodeInput hides its capture field behind decorative cells this way.
    render(<Input testID="input" style={{ color: 'transparent' }} />);

    expect(colorOf('input')).toBe('transparent');
  });
});

/**
 * `withUnistyles` flattens the style prop ONCE. A wrapper that nests a caller's
 * array inside its own leaves `[base, [a, b]]`, and the styles inside that
 * second level never resolve — the field renders without them, silently.
 */
describe('ThemedTextInput style composition', () => {
  const Input = ThemedTextInput;

  const depth = (style: unknown): number =>
    Array.isArray(style) ? 1 + Math.max(0, ...style.map(depth)) : 0;

  it('stays within one flatten when the caller passes an array', () => {
    render(<Input testID="input" style={[{ margin: 1 }, { padding: 2 }]} />);

    expect(depth(screen.getByTestId('input').props.style)).toBeLessThanOrEqual(
      1,
    );
  });

  it('keeps every caller style reachable after that flatten', () => {
    render(<Input testID="input" style={[{ margin: 1 }, { padding: 2 }]} />);

    const onePass = [screen.getByTestId('input').props.style].flat();

    expect(onePass).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ margin: 1 }),
        expect.objectContaining({ padding: 2 }),
      ]),
    );
  });
});
