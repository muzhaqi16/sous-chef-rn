import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  ThemedBottomSheetTextInput,
  ThemedTextInput,
} from '../themedComponents';

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

describe.each([
  ['ThemedTextInput', ThemedTextInput],
  ['ThemedBottomSheetTextInput', ThemedBottomSheetTextInput],
] as const)('%s', (_name, Input) => {
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
describe.each([
  ['ThemedTextInput', ThemedTextInput],
  ['ThemedBottomSheetTextInput', ThemedBottomSheetTextInput],
] as const)('%s style composition', (_name, Input) => {
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
