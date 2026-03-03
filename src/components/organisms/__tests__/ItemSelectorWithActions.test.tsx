'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ItemSelectorWithActions } from '../ItemSelectorWithActions';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
  IconLibrary: {},
}));
jest.mock('#components/molecules/ListActionButtons', () => ({
  ListActionButtons: ({ actions }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        {actions.map((a: any, i: number) => (
          <Pressable key={i} onPress={a.onPress}><Text>{a.label}</Text></Pressable>
        ))}
      </View>
    );
  },
}));

describe('ItemSelectorWithActions', () => {
  const items = [
    { id: '1', name: 'Item A' },
    { id: '2', name: 'Item B' },
  ];
  const onSelect = jest.fn();

  it('renders items', () => {
    render(
      <ItemSelectorWithActions data={items} onSelect={onSelect} displayProperty="name" />,
    );
    expect(screen.getByText('Item A')).toBeTruthy();
    expect(screen.getByText('Item B')).toBeTruthy();
  });

  it('shows empty message when no data', () => {
    render(
      <ItemSelectorWithActions data={[]} onSelect={onSelect} displayProperty="name" emptyMessage="Empty" />,
    );
    expect(screen.getByText('Empty')).toBeTruthy();
  });

  it('renders action buttons', () => {
    const actions = [{ icon: 'add', label: 'Add New', onPress: jest.fn() }];
    render(
      <ItemSelectorWithActions data={items} onSelect={onSelect} displayProperty="name" actions={actions} />,
    );
    expect(screen.getByText('Add New')).toBeTruthy();
  });
});
