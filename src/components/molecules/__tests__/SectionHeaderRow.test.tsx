import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SectionHeaderRow } from '../SectionHeaderRow';

describe('SectionHeaderRow', () => {
  it('shows the heading alone without an action', () => {
    render(<SectionHeaderRow title="Today's meals" />);
    expect(screen.getByText("Today's meals")).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('runs its action from the row end', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(
      <SectionHeaderRow
        title="Based on your pantry"
        action={{ label: 'See all', onPress }}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'See all' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('holds a disabled action still', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(
      <SectionHeaderRow
        title="Ingredients"
        action={{ label: 'Adding...', onPress, disabled: true }}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Adding...' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
