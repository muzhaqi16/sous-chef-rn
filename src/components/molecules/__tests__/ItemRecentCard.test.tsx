'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ItemRecentCard } from '../ItemRecentCard';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#hooks/performance/useRenderTime', () => ({
  useRenderTime: jest.fn(),
}));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => {
    const { View } = require('react-native');
    return <View testID="cached-image" />;
  },
}));
jest.mock('date-fns/formatDistanceToNow', () => ({
  formatDistanceToNow: () => '2 days',
}));

describe('ItemRecentCard', () => {
  const item = {
    id: '1',
    itemName: 'Eggs',
    createdAt: '2026-02-28T00:00:00Z',
    item: { imageUrl: null },
  };
  const onQuickAdd = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders item name', () => {
    render(<ItemRecentCard item={item} onQuickAdd={onQuickAdd} />);
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  it('renders time ago text', () => {
    render(<ItemRecentCard item={item} onQuickAdd={onQuickAdd} />);
    expect(screen.getByText('Added 2 days ago')).toBeTruthy();
  });

  it('calls onQuickAdd when add button pressed', () => {
    render(<ItemRecentCard item={item} onQuickAdd={onQuickAdd} />);
    // The add button has the "add" icon
    fireEvent.press(screen.getByText('add'));
    expect(onQuickAdd).toHaveBeenCalledWith(item);
  });

  it('shows Unknown Item for null itemName', () => {
    render(
      <ItemRecentCard
        item={{ ...item, itemName: null }}
        onQuickAdd={onQuickAdd}
      />,
    );
    expect(screen.getByText('Unknown Item')).toBeTruthy();
  });
});
