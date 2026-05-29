'use no memo';

import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';
import { ShareList } from '../ShareList';

const seedCollaboratorCache = () =>
  seedCache([
    {
      __typename: 'ShoppingListCollaborator',
      id: 'c1',
      email: 'owner@test.com',
      role: 'OWNER',
      status: 'ACTIVE',
      collaboratorId: 'u1',
      canAddItems: true,
      canRemoveItems: true,
      canEditItems: true,
      canMarkPurchased: true,
      invitedAt: '2024-01-01T00:00:00Z',
      collaborator: null,
    },
    {
      __typename: 'ShoppingListCollaborator',
      id: 'c2',
      email: 'member@test.com',
      role: 'CONTRIBUTOR',
      status: 'ACCEPTED',
      collaboratorId: 'u2',
      canAddItems: true,
      canRemoveItems: false,
      canEditItems: false,
      canMarkPurchased: true,
      invitedAt: '2024-01-05T00:00:00Z',
      collaborator: null,
    },
  ]);

const render = (ui: any) =>
  renderWithApollo(ui, { cache: seedCollaboratorCache() });

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => {
  const mockState = { user: { id: 'u1', email: 'owner@test.com' } };
  const fn = (selector: any) => selector(mockState);
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn, useUser: jest.fn(() => mockState.user) };
});

// useShoppingListDetails now returns already-materialized collaborator
// fragments (with invitedAt), which ShareList consumes directly.
const mockCollaborators = [
  {
    __typename: 'ShoppingListCollaborator',
    id: 'c1',
    email: 'owner@test.com',
    role: 'OWNER',
    status: 'ACTIVE',
    collaboratorId: 'u1',
    canAddItems: true,
    canRemoveItems: true,
    canEditItems: true,
    canMarkPurchased: true,
    invitedAt: '2024-01-01T00:00:00Z',
    collaborator: null,
  },
  {
    __typename: 'ShoppingListCollaborator',
    id: 'c2',
    email: 'member@test.com',
    role: 'CONTRIBUTOR',
    status: 'ACCEPTED',
    collaboratorId: 'u2',
    canAddItems: true,
    canRemoveItems: false,
    canEditItems: false,
    canMarkPurchased: true,
    invitedAt: '2024-01-05T00:00:00Z',
    collaborator: null,
  },
];

jest.mock('#features/shoppingList/hooks/useShoppingListDetails', () => ({
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

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));
jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/atoms/EmailInput', () => ({
  EmailInput: (props: any) => {
    const { TextInput } = require('react-native');
    return <TextInput placeholder="Enter email address" {...props} />;
  },
}));
jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
      </View>
    );
  },
}));
jest.mock('#components/base/Loading', () => ({
  LoadingInline: () => null,
}));
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
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
    expect(screen.getAllByText('owner@test.com').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getAllByText('member@test.com').length,
    ).toBeGreaterThanOrEqual(1);
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
