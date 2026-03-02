'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SelectorItem } from '../SelectorItem';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

describe('SelectorItem', () => {
  const item = { id: '1', name: 'Pantry A' };
  const onSelect = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders item display property', () => {
    render(
      <SelectorItem item={item} isSelected={false} onSelect={onSelect} displayProperty="name" />,
    );
    expect(screen.getByText('Pantry A')).toBeTruthy();
  });

  it('shows checkmark when selected', () => {
    render(
      <SelectorItem item={item} isSelected={true} onSelect={onSelect} displayProperty="name" />,
    );
    expect(screen.getByText('checkmark')).toBeTruthy();
  });

  it('calls onSelect with item id and item on press', () => {
    render(
      <SelectorItem item={item} isSelected={false} onSelect={onSelect} displayProperty="name" />,
    );
    fireEvent.press(screen.getByText('Pantry A'));
    expect(onSelect).toHaveBeenCalledWith('1', item);
  });
});
