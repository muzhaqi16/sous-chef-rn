import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { StatCard } from '../StatCard';

const renderCard = (count: number, onPress = jest.fn()) => {
  render(
    <StatCard
      count={count}
      label="Expired"
      tone="error"
      onPress={onPress}
      accessibilityLabel={`${count} expired`}
      testID="stat"
    />,
  );
  return onPress;
};

describe('StatCard', () => {
  it('shows the count over its label and opens what it counts', async () => {
    const user = userEvent.setup();
    const onPress = renderCard(6);

    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('Expired')).toBeTruthy();
    await user.press(screen.getByLabelText('6 expired'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows 0 and opens nothing at zero', async () => {
    const user = userEvent.setup();
    const onPress = renderCard(0);

    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByTestId('stat')).toBeDisabled();
    await user.press(screen.getByTestId('stat'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is a button named by its phrase', () => {
    renderCard(3);
    expect(screen.getByRole('button', { name: '3 expired' })).toBeTruthy();
  });
});
