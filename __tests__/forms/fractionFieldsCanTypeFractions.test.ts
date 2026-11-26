import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FractionInput } from '#components/molecules/FractionInput';

/**
 * `FractionInput` is seeded with text like "1 1/2", and its quick-select chips
 * write "1/2" into it. A digits-only or decimal keypad has no "/" and no space,
 * so after one edit the person cannot type the value back. The field takes no
 * keypad from its caller, so no caller can pick one without a slash.
 */

type FractionInputProps = React.ComponentProps<typeof FractionInput>;

// Fails typecheck if a `keyboardType` prop is ever added back.
const takesNoKeypad: 'keyboardType' extends keyof FractionInputProps
  ? false
  : true = true;

describe('a fraction field is shown with a keypad that can type a fraction', () => {
  it('takes no keypad from its caller', () => {
    expect(takesNoKeypad).toBe(true);
  });

  it('opens the keypad with a slash and a space', () => {
    render(
      React.createElement(FractionInput, {
        value: '1 1/2',
        onChangeText: jest.fn(),
        testID: 'fraction',
      }),
    );

    expect(screen.getByTestId('fraction').props.keyboardType).toBe(
      'numbers-and-punctuation',
    );
  });
});
