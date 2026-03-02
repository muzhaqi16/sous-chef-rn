'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QuickAddBar } from '../QuickAddBar';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#/utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

describe('QuickAddBar', () => {
  const onAddItem = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders input fields', () => {
    render(<QuickAddBar onAddItem={onAddItem} />);
    expect(screen.getByLabelText('Item name')).toBeTruthy();
    expect(screen.getByLabelText('Quantity')).toBeTruthy();
  });

  it('returns null when visible is false', () => {
    const { toJSON } = render(<QuickAddBar onAddItem={onAddItem} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('calls onAddItem when add button pressed with text', () => {
    render(<QuickAddBar onAddItem={onAddItem} />);
    fireEvent.changeText(screen.getByLabelText('Item name'), 'Milk');
    fireEvent.press(screen.getByLabelText('Add item'));
    expect(onAddItem).toHaveBeenCalledWith('Milk', 1);
  });
});
