'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SmartSearchAddBar } from '../SmartSearchAddBar';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('../Counter', () => ({
  Counter: ({ count }: any) => {
    const { Text } = require('react-native');
    return <Text>Count: {count}</Text>;
  },
}));

describe('SmartSearchAddBar', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
    onAddItem: jest.fn(),
  };

  it('renders with placeholder', () => {
    render(<SmartSearchAddBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search or add item...')).toBeTruthy();
  });

  it('shows suggestions when provided', () => {
    const suggestions = [
      { id: '1', name: 'Apples' },
      { id: '2', name: 'Bananas' },
    ];
    render(<SmartSearchAddBar {...defaultProps} value="a" suggestions={suggestions} />);
    expect(screen.getByText('Apples')).toBeTruthy();
    expect(screen.getByText('Bananas')).toBeTruthy();
  });

  it('calls onChangeText when typing', () => {
    render(<SmartSearchAddBar {...defaultProps} />);
    fireEvent.changeText(screen.getByPlaceholderText('Search or add item...'), 'test');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('test');
  });
});
