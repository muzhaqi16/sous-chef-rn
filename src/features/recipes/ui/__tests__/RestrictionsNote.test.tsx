import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRestrictionsNote } from '#features/recipes/hooks/useRestrictionsNote';
import { RestrictionsNote } from '../RestrictionsNote';

jest.mock('#features/recipes/hooks/useRestrictionsNote', () => ({
  useRestrictionsNote: jest.fn(),
}));

describe('RestrictionsNote', () => {
  it('shows what the suggestions honor and opens the Dietary Profile', () => {
    jest.mocked(useRestrictionsNote).mockReturnValue('Vegetarian • No peanut');
    const onPress = jest.fn();
    render(
      <RestrictionsNote homeId="home-1" onPress={onPress} testID="note" />,
    );

    fireEvent.press(screen.getByText('Vegetarian • No peanut'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('note').props.accessibilityHint).toBe(
      'Opens your Dietary Profile',
    );
  });

  it('renders nothing with no restriction held', () => {
    jest.mocked(useRestrictionsNote).mockReturnValue(null);

    render(<RestrictionsNote homeId="home-1" testID="note" />);

    expect(screen.queryByTestId('note')).toBeNull();
  });
});
