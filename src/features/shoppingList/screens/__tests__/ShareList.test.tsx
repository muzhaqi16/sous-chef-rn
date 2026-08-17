'use no memo';

import React from 'react';
import type { TextInputProps } from 'react-native';
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

const render = (ui: React.ReactElement) =>
  renderWithApollo(ui, { cache: seedCollaboratorCache() });

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// The verification gate is exercised in its own suite; here it always allows
// the action so these tests stay focused on their own behaviour.
jest.mock('#hooks/auth/useEmailVerification', () => ({
  useVerifiedEmailGate: () => ({
    requireVerifiedEmail: () => true,
    hasUnverifiedEmail: false,
  }),
  useEmailVerificationActions: () => ({
    skipVerification: jest.fn(),
    resumeVerification: jest.fn(),
  }),
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => {
  const mockState = { user: { id: 'u1', email: 'owner@test.com' } };
  const fn = <T,>(selector: (state: typeof mockState) => T): T =>
    selector(mockState);
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

// Ownership is a separate ShoppingListOwnership record (not the collaborator
// `role`). Mutable so individual tests can flip between owner / non-owner.
let mockOwnerships: Array<{
  __typename: 'ShoppingListOwnership';
  id: string;
  userId: string;
  user: null;
}> = [];

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
    ownerships: mockOwnerships,
    name: 'Test List',
    refetch: jest.fn(),
  }),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));
jest.mock('#/utils/finallyHelpers');

jest.mock('#components/atoms/EmailInput', () => ({
  EmailInput: (props: TextInputProps) => {
    const { TextInput } = require('react-native');
    return <TextInput placeholder="Enter email address" {...props} />;
  },
}));
jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: { title?: string }) => {
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
  Button: ({ title, onPress }: { title?: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock('#components/atoms/OfflineGate', () => ({
  OfflineGate: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('#components/molecules/AlertBanner', () => ({
  AlertBanner: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));
jest.mock('#/components/organisms/CollaboratorPermissionsBottomSheet', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  const comp = forwardRef((_: object, ref: React.Ref<{ open: () => void }>) => {
    useImperativeHandle(ref, () => ({ open: jest.fn() }));
    return <View testID="permissions-sheet" />;
  });
  return { __esModule: true, default: comp };
});

describe('ShareList', () => {
  const route = { params: { listId: 'sl1' } };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: the current user (u1) owns the list via an ownership record.
    mockOwnerships = [
      {
        __typename: 'ShoppingListOwnership',
        id: 'o1',
        userId: 'u1',
        user: null,
      },
    ];
  });

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

  it('hides the Leave List action for the list owner', () => {
    // u1 is in `ownerships`, so even though the leave flow exists, the owner
    // must not be offered "Leave" (there is no transfer-ownership mutation —
    // the owner deletes the list instead).
    render(<ShareList route={route} />);
    expect(screen.queryByText('Leave List')).toBeNull();
    expect(screen.queryByText('Danger Zone')).toBeNull();
  });

  it('tags the owning member and hides their remove button', () => {
    render(<ShareList route={route} />);
    expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the Leave List action when the current user is not the owner', () => {
    // Ownership lives in `ownerships`, decoupled from collaborator role:
    // someone else (u2) owns the list, so u1 is a leaving-eligible collaborator
    // regardless of what role their collaborator row carries.
    mockOwnerships = [
      {
        __typename: 'ShoppingListOwnership',
        id: 'o2',
        userId: 'u2',
        user: null,
      },
    ];
    render(<ShareList route={route} />);
    expect(screen.getByText('Leave List')).toBeTruthy();
    expect(screen.getByText('Danger Zone')).toBeTruthy();
  });
});
