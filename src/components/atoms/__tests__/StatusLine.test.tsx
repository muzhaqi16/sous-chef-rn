import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { render, screen } from '@testing-library/react-native';
import { StatusLine, type StatusTone } from '#components/atoms/StatusLine';
import { Text } from '#components/atoms/Text';

// The Unistyles mock does not resolve variants, so this reads what the line
// asks `Text` for; `toneContrast.test.ts` holds each tone's colour to AA.
const textOf = (tone: StatusTone) => {
  render(<StatusLine tone={tone}>Expires tomorrow</StatusLine>);
  return screen.UNSAFE_getByType(Text).props;
};

describe('StatusLine', () => {
  it.each([
    ['error', 'error'],
    ['warning', 'warning'],
    ['info', 'info'],
    ['neutral', 'secondary'],
    ['pending', 'secondary'],
  ] as const)('paints a %s status in the %s tone', (status, tone) => {
    expect(textOf(status).tone).toBe(tone);
  });

  it('sets an urgent status in bold and a neutral one in regular weight', () => {
    expect(textOf('error').role).toBe('footnoteStrong');
    expect(textOf('neutral').role).toBe('footnote');
  });

  it('italicizes a pending status so it reads as provisional', () => {
    expect(StyleSheet.flatten(textOf('pending').style)).toMatchObject({
      fontStyle: 'italic',
    });
    expect(textOf('warning').style).toBeUndefined();
  });

  it('keeps to one line', () => {
    expect(textOf('warning').numberOfLines).toBe(1);
  });
});
