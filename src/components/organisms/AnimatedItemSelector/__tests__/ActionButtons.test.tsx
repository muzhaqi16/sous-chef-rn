'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ActionButtons } from '../ActionButtons';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#constants/animations', () => ({}));

describe('ActionButtons', () => {
  it('returns null for empty actions', () => {
    const { toJSON } = render(<ActionButtons actions={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders action buttons with labels', () => {
    const actions = [
      { icon: 'add', label: 'Create', onPress: jest.fn() },
      { icon: 'edit', label: 'Edit', onPress: jest.fn() },
    ];
    render(<ActionButtons actions={actions} />);
    expect(screen.getByText('Create')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
  });

  it('calls onPress when button is pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const actions = [{ icon: 'add', label: 'Create', onPress }];
    render(<ActionButtons actions={actions} />);
    await user.press(screen.getByText('Create'));
    expect(onPress).toHaveBeenCalled();
  });
});
