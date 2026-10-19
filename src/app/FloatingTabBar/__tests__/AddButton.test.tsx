import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { kitTestIDs } from '#components/testIDs';
import { AddButton } from '../AddButton';

describe('AddButton', () => {
  // A lone action that cannot run says why on the press, so it must arrive.
  it('is announced as disabled and still takes the press', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<AddButton onPress={onPress} disabled />);

    const button = screen.getByTestId(kitTestIDs.tabBarAddButton);
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
