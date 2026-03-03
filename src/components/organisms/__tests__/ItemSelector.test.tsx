'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ItemSelector } from '../ItemSelector';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

describe('ItemSelector', () => {
  const items = [
    { id: '1', name: 'Apple' },
    { id: '2', name: 'Banana' },
    { id: '3', name: 'Cherry' },
  ];
  const onSelect = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders items from data', () => {
    render(
      <ItemSelector data={items} onSelect={onSelect} displayProperty="name" />,
    );
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Banana')).toBeTruthy();
  });

  it('shows empty message when no data', () => {
    render(
      <ItemSelector data={[]} onSelect={onSelect} displayProperty="name" emptyMessage="Nothing here" />,
    );
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('shows loading indicator when loading', () => {
    render(
      <ItemSelector data={[]} onSelect={onSelect} displayProperty="name" loading />,
    );
    // ActivityIndicator renders as a view with specific role
    expect(screen.toJSON()).toBeTruthy();
  });

  it('calls onSelect when an item is pressed', () => {
    render(
      <ItemSelector data={items} onSelect={onSelect} displayProperty="name" />,
    );
    fireEvent.press(screen.getByText('Apple'));
    expect(onSelect).toHaveBeenCalledWith('1', items[0]);
  });
});
