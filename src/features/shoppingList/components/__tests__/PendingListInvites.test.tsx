import React from 'react';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  CollaboratorRole,
  CollaboratorStatus,
} from '#/graphql/generated/schemaTypes';
import { AcceptShoppingListInviteDocument } from '#features/shoppingList/graphql/collaboration.generated';
import { GetPendingListInvitesDocument } from '#features/shoppingList/hooks/usePendingListInvites.generated';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { alertService } from '#/services/alertService';
import { useStore } from '#store';
import { PendingListInvites } from '../PendingListInvites';

// The list selector is a sheet, portalled outside the navigator, where
// navigation throws.
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => {
    throw new Error("Couldn't find a navigation object.");
  },
}));

afterEach(() => {
  jest.useRealTimers();
});

const pending = (
  edges: NonNullable<
    NonNullable<
      MockDataFor<typeof GetPendingListInvitesDocument>['me']
    >['pendingCollaborationInvitesConnection']
  >['edges'],
) =>
  recordMock(GetPendingListInvitesDocument, {
    data: {
      me: {
        __typename: 'User',
        id: 'user-1',
        pendingCollaborationInvitesConnection: { edges },
      },
    },
  });

const TWO_INVITES = pending([
  {
    node: {
      __typename: 'ShoppingListCollaborator',
      id: 'inv-1',
      role: CollaboratorRole.Editor,
      inviterName: 'Alice',
      shoppingList: {
        __typename: 'ShoppingList',
        id: 'list-1',
        name: 'Weekly groceries',
      },
    },
  },
  {
    node: {
      __typename: 'ShoppingListCollaborator',
      id: 'inv-2',
      role: CollaboratorRole.Viewer,
      inviterName: null,
      shoppingList: { __typename: 'ShoppingList', id: 'list-2', name: 'Party' },
    },
  },
]);

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'invitee@example.com',
      emailVerified: true,
      onBoarded: true,
    },
  });
});

afterEach(() => {
  useStore.setState({ user: null });
});

const verified = () => true;

describe('PendingListInvites', () => {
  it('shows each invite with its sender, role, and both answers', async () => {
    renderWithApollo(
      <PendingListInvites
        onAccepted={jest.fn()}
        requireVerifiedEmail={verified}
      />,
      {
        operationMocks: [TWO_INVITES.mock],
      },
    );

    expect(await screen.findByText('Pending Invitations')).toBeTruthy();
    expect(screen.getByText('Weekly groceries')).toBeTruthy();
    expect(screen.getByText('Alice invited you · Editor')).toBeTruthy();
    // No name to show: the sender is left out rather than guessed.
    expect(screen.getByText("You've been invited · Viewer")).toBeTruthy();
    for (const id of ['inv-1', 'inv-2']) {
      expect(
        screen.getByTestId(shoppingListTestIDs.pendingInviteAccept(id)),
      ).toHaveTextContent('Accept');
      expect(
        screen.getByTestId(shoppingListTestIDs.pendingInviteDecline(id)),
      ).toHaveTextContent('Decline');
    }
  });

  it('accepts by id and selects the list it joined', async () => {
    const accept = recordMock(AcceptShoppingListInviteDocument, {
      data: {
        acceptShoppingListInvite: {
          __typename: 'AcceptShoppingListInvitePayload',
          collaborator: {
            __typename: 'ShoppingListCollaborator',
            id: 'inv-1',
            status: CollaboratorStatus.Active,
          },
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            homeId: null,
            home: null,
          },
        },
      },
    });
    const onAccepted = jest.fn();
    const user = userEvent.setup();
    renderWithApollo(
      <PendingListInvites
        onAccepted={onAccepted}
        requireVerifiedEmail={verified}
      />,
      {
        operationMocks: [TWO_INVITES.mock, accept.mock],
      },
    );

    await act(async () => {
      await user.press(
        await screen.findByTestId(
          shoppingListTestIDs.pendingInviteAccept('inv-1'),
        ),
      );
    });

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith('list-1'));
    expect(accept.fired).toEqual([{ input: { inviteId: 'inv-1' } }]);
  });

  it('asks before declining', async () => {
    const user = userEvent.setup();
    renderWithApollo(
      <PendingListInvites
        onAccepted={jest.fn()}
        requireVerifiedEmail={verified}
      />,
      {
        operationMocks: [TWO_INVITES.mock],
      },
    );

    await act(async () => {
      await user.press(
        await screen.findByTestId(
          shoppingListTestIDs.pendingInviteDecline('inv-2'),
        ),
      );
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Decline Invitation',
      'Are you sure you want to decline this invitation to Party?',
      expect.any(Array),
    );
  });

  it('renders nothing while no invite is pending', async () => {
    jest.useFakeTimers();
    const none = pending([]);
    renderWithApollo(
      <PendingListInvites
        onAccepted={jest.fn()}
        requireVerifiedEmail={verified}
      />,
      {
        operationMocks: [none.mock],
      },
    );

    await drainTimers();

    expect(none.fired).toHaveLength(1);
    expect(screen.queryByTestId(shoppingListTestIDs.pendingInvites)).toBeNull();
  });
});
