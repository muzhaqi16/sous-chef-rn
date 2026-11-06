import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProgressBar } from '../ProgressBar';

const reported = () =>
  screen.getByTestId('bar').props.accessibilityValue as { now: number };

describe('ProgressBar', () => {
  it('reports its position to assistive technology as a percentage', () => {
    render(
      <ProgressBar
        value={1 / 3}
        accessibilityLabel="Step 1 of 3"
        testID="bar"
      />,
    );

    expect(reported().now).toBe(33);
    expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
  });

  it('clamps a ratio outside 0–1, and reads a non-number as empty', () => {
    const { rerender } = render(<ProgressBar value={1.4} testID="bar" />);
    expect(reported().now).toBe(100);

    rerender(<ProgressBar value={Number.NaN} testID="bar" />);
    expect(reported().now).toBe(0);
  });

  it('follows a new value', () => {
    const { rerender } = render(<ProgressBar value={1 / 3} testID="bar" />);

    rerender(<ProgressBar value={2 / 3} testID="bar" />);

    expect(reported().now).toBe(67);
  });
});
