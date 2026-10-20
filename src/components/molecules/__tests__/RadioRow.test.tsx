import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { RadioRow } from '../RadioRow';

describe('RadioRow', () => {
  it('is announced as a radio, checked when selected, and picks on press', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(
      <RadioRow selected onPress={onPress}>
        <Text>Weekly</Text>
      </RadioRow>,
    );

    const radio = screen.getByRole('radio', { name: 'Weekly' });
    expect(radio).toBeChecked();
    await user.press(radio);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('runs nothing while disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(
      <RadioRow selected={false} disabled onPress={onPress}>
        <Text>Weekly</Text>
      </RadioRow>,
    );

    const radio = screen.getByRole('radio', { name: 'Weekly' });
    expect(radio).not.toBeChecked();
    await user.press(radio);
    expect(onPress).not.toHaveBeenCalled();
  });
});
