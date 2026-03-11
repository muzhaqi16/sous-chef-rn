'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ShareList } from '../ShareList';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => {
  const selectUser = (s: any) => s.user;
  const fn = (selector: any) => selector({ user: { id: 'u1', email: 'owner@test.com' } });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn, selectUser };
});

const mockCollaborators = [
  { id: 'c1', email: 'owner@test.com', collaboratorId: 'u1', role: 'OWNER', status: 'ACTIVE', invitedAt: '2024-01-01T00:00:00Z' },
  { id: 'c2', email: 'member@test.com', collaboratorId: 'u2', role: 'CONTRIBUTOR', status: 'ACCEPTED', invitedAt: '2024-01-05T00:00:00Z' },
];

jest.mock('#hooks/shoppingList/useShoppingListDetails', () => ({
  useShoppingListDetails: () => ({
    shoppingList: {
      id: 'sl1',
      name: 'Test List',
      homeId: null,
      home: null,
    },
    loading: false,
    isRefetching: false,
    collaborators: mockCollaborators,
    name: 'Test List',
    refetch: jest.fn(),
  }),
}));

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useRemoveCollaboratorMutation: jest.fn(() => [jest.fn(), { loading: false }]),
  useAddCollaboratorMutation: jest.fn(() => [jest.fn(), { loading: false }]),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));
jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="header"><Text>{title}</Text></View>;
  },
}));
jest.mock('#components/base/Loading', () => ({
  LoadingInline: () => null,
}));
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>;
  },
}));
jest.mock('#components/atoms/OfflineGate', () => ({
  OfflineGate: ({ children }: any) => children,
}));
jest.mock('#components/molecules/AlertBanner', () => ({
  AlertBanner: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));
jest.mock('#/components/organisms/CollaboratorPermissionsBottomSheet', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  const comp = forwardRef((_: any, ref: any) => {
    useImperativeHandle(ref, () => ({ open: jest.fn() }));
    return <View testID="permissions-sheet" />;
  });
  return { __esModule: true, default: comp };
});

describe('ShareList', () => {
  const route = { params: { listId: 'sl1' } };

  beforeEach(() => jest.clearAllMocks());

  it('renders the title', () => {
    render(<ShareList route={route} />);
    expect(screen.getByText('Share List')).toBeTruthy();
  });

  it('shows invite section', () => {
    render(<ShareList route={route} />);
    expect(screen.getByText('Invite Members')).toBeTruthy();
  });

  it('shows current members section', () => {
    render(<ShareList route={route} />);
    expect(screen.getByText('Current Members')).toBeTruthy();
  });

  it('shows member emails', () => {
    render(<ShareList route={route} />);
    expect(screen.getAllByText('owner@test.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('member@test.com').length).toBeGreaterThanOrEqual(1);
  });

  it('shows member statuses', () => {
    render(<ShareList route={route} />);
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
  });

  it('shows email input placeholder', () => {
    render(<ShareList route={route} />);
    expect(screen.getByPlaceholderText('Enter email address')).toBeTruthy();
  });
});
