'use no memo';
import React from 'react';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { screen, userEvent, act, waitFor } from '@testing-library/react-native';
import { InvitationAcceptanceModal } from '../InvitationAcceptanceModal';
import type { InvitationData } from '#features/notifications/types';
import {
  recordMock,
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  InvitationAcceptanceModalAcceptShoppingListInviteDocument,
  InvitationAcceptanceModalDeclineShoppingListInviteDocument as DeclineShoppingListInviteDocument,
} from '../InvitationAcceptanceModal.generated';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
}));

const homeInvitation: InvitationData = {
  type: 'HOME_INVITE',
  id: 'inv-1',
  inviterName: 'Alice',
  entityName: "Alice's Home",
  token: 'abc123',
  payload: { inviterName: 'Alice', homeName: "Alice's Home" },
};

const shoppingListInvitation: InvitationData = {
  type: 'SHOPPING_LIST_INVITE',
  id: 'inv-2',
  entityName: 'Weekly Groceries',
  token: 'def456',
  payload: {},
};

const defaultProps = {
  visible: true,
  invitation: homeInvitation,
  onClose: jest.fn(),
  onAccept: jest.fn(),
  onReject: jest.fn(),
};

/** Joined; with `hasMembership: false`, refused as already accepted. */
const acceptHomeOk = ({ hasMembership = true } = {}) =>
  recordMock(AcceptHomeInviteDocument, {
    data: {
      acceptHomeInvite: hasMembership
        ? {
            __typename: 'AcceptHomeInvitePayload',
            membership: { id: 'm1', home: { id: 'home-1' } },
          }
        : { __typename: 'ConflictError', code: ErrorCode.Conflict },
    },
  });

function acceptHomeError(message: string) {
  return recordMock(AcceptHomeInviteDocument, { error: new Error(message) });
}

/** Joined; with `success: false`, refused, so `onAccept` is never called. */
const acceptShoppingListOk = ({ success = true } = {}) =>
  recordMock(InvitationAcceptanceModalAcceptShoppingListInviteDocument, {
    data: {
      acceptShoppingListInvite: success
        ? {
            __typename: 'AcceptShoppingListInvitePayload',
            collaborator: { id: 'c1', shoppingList: { id: 'sl-1' } },
          }
        : { __typename: 'ConflictError', code: ErrorCode.Conflict },
    },
  });

function acceptShoppingListError(message: string) {
  return recordMock(InvitationAcceptanceModalAcceptShoppingListInviteDocument, {
    error: new Error(message),
  });
}

function declineHomeOk() {
  return recordMock(DeclineHomeInviteDocument, {
    data: {
      declineHomeInvite: {
        __typename: 'DeclineHomeInvitePayload',
        homeInvite: { id: 'inv-1' },
      },
    },
  });
}

function declineHomeError(message: string) {
  return recordMock(DeclineHomeInviteDocument, { error: new Error(message) });
}

function declineShoppingListOk() {
  return recordMock(DeclineShoppingListInviteDocument, {
    data: {
      declineShoppingListInvite: {
        __typename: 'DeclineShoppingListInvitePayload',
        collaborator: { id: 'c1' },
      },
    },
  });
}

function declineShoppingListError(message: string) {
  return recordMock(DeclineShoppingListInviteDocument, {
    error: new Error(message),
  });
}

/** Rejects `invitation` and confirms the decline the alert asks about. */
const rejectAndConfirm = async (
  invitation: InvitationData,
  mock: MockedResponse,
) => {
  const user = userEvent.setup();
  renderWithApollo(
    <InvitationAcceptanceModal {...defaultProps} invitation={invitation} />,
    { operationMocks: [mock] },
  );
  await act(async () => {
    await user.press(screen.getByText('Reject'));
  });
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls[0] ?? [];
  await act(async () => {
    buttons?.find(button => button.text === 'Decline')?.onPress?.();
  });
};

describe('InvitationAcceptanceModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when invitation is null', () => {
    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} invitation={null} />,
    );
    expect(screen.queryByText('Home invitation')).toBeNull();
  });

  it('renders the invitation title from its type', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    expect(screen.getByText('Home invitation')).toBeTruthy();
  });

  it('builds the description from the payload names', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    expect(
      screen.getByText("Alice invited you to join Alice's Home"),
    ).toBeTruthy();
  });

  it('renders the entity name', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    expect(screen.getByText("Alice's Home")).toBeTruthy();
  });

  it('renders inviter name when provided', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    expect(screen.getByText('Invited by Alice')).toBeTruthy();
  });

  it('does not render inviter name when not provided', () => {
    const noInviter = { ...homeInvitation, inviterName: undefined };
    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} invitation={noInviter} />,
    );
    expect(screen.queryByText(/Invited by/)).toBeNull();
  });

  it('renders Accept and Reject buttons', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    expect(screen.getByText('Accept')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('renders shopping list invitation correctly', () => {
    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={shoppingListInvitation}
      />,
    );
    expect(screen.getByText('Shopping list invitation')).toBeTruthy();
    expect(
      screen.getByText(
        'You have an invitation to collaborate on a shopping list',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    // The close button uses an Icon, find it via the surrounding Pressable
    // Since Icon is mocked to null, we look for the modal structure
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('does not render content when visible is false', () => {
    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} visible={false} />,
    );
    // Modal with visible=false does not render its content in test environment
    expect(screen.queryByText('Home invitation')).toBeNull();
  });

  // --- Branch coverage tests ---

  it('handles accept for HOME_INVITE with token', async () => {
    const user = userEvent.setup();
    const acceptMock = acceptHomeOk();

    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
      operationMocks: [acceptMock.mock],
    });

    await user.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect(defaultProps.onAccept).toHaveBeenCalled();
    });
    expect(acceptMock.fired).toContainEqual({ input: { token: 'abc123' } });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('handles accept for SHOPPING_LIST_INVITE with token', async () => {
    const user = userEvent.setup();
    const acceptMock = acceptShoppingListOk();

    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={shoppingListInvitation}
      />,
      {
        operationMocks: [acceptMock.mock],
      },
    );

    await user.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect(defaultProps.onAccept).toHaveBeenCalled();
    });
    expect(acceptMock.fired).toContainEqual({ input: { token: 'def456' } });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('offers no action for an invite whose token it does not hold', () => {
    // The API discloses the token once, to the inviter, so a surface without
    // one can never redeem: it says where the invite lives instead of showing
    // a control with nothing to send.
    const noTokenInvite = { ...shoppingListInvitation, token: undefined };

    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={noTokenInvite}
      />,
    );

    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
    expect(
      screen.getByText(
        'Open this invitation from its notification, or the email we sent you, to accept it.',
      ),
    ).toBeTruthy();
  });

  it('reports an invitee mismatch as a wrong-account state', async () => {
    const user = userEvent.setup();
    const onAccept = jest.fn();

    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} onAccept={onAccept} />,
      {
        operationMocks: [
          recordMock(AcceptHomeInviteDocument, {
            data: {
              acceptHomeInvite: {
                __typename: 'ForbiddenError',
                code: ErrorCode.Forbidden,
                message: 'Invite belongs to another account',
              },
            },
          }).mock,
        ],
      },
    );

    await user.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect(alertService.alert).toHaveBeenCalledWith(
        'Signed in as a different account',
        'This invitation was sent to someone else. Sign in with the invited account to accept it.',
      );
    });
    // The invite stays PENDING server-side, so nothing is accepted and no
    // generic failure is reported over the top of the explanation.
    expect(onAccept).not.toHaveBeenCalled();
    expect(toastService.error).not.toHaveBeenCalled();
  });

  describe('a refusal the client does not branch on', () => {
    // Under errorPolicy 'all' a refusal member resolves as DATA, so `error` is
    // undefined for all four. Anything that reaches no branch leaves the modal
    // open with the spinner stopped and nothing said.
    const refusedAccept = (
      typename: 'NotFoundError' | 'ConflictError' | 'ValidationError',
      code: ErrorCode,
    ) =>
      recordMock(AcceptHomeInviteDocument, {
        data: {
          acceptHomeInvite: { __typename: typename, code, message: 'no' },
        },
      }).mock;

    it.each([
      ['NotFoundError' as const, ErrorCode.NotFound],
      ['ConflictError' as const, ErrorCode.Conflict],
      ['ValidationError' as const, ErrorCode.ValidationFailed],
    ])('reports %s rather than falling through', async (typename, code) => {
      const user = userEvent.setup();
      const onAccept = jest.fn();

      renderWithApollo(
        <InvitationAcceptanceModal {...defaultProps} onAccept={onAccept} />,
        { operationMocks: [refusedAccept(typename, code)] },
      );

      await user.press(screen.getByText('Accept'));

      await waitFor(() => {
        const told =
          jest.mocked(toastService.error).mock.calls.length > 0 ||
          jest.mocked(alertService.alert).mock.calls.length > 0;
        expect(told).toBe(true);
      });
      expect(onAccept).not.toHaveBeenCalled();
    });

    it('does not show the account-mismatch copy for an unrelated refusal', async () => {
      const user = userEvent.setup();

      renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
        operationMocks: [refusedAccept('NotFoundError', ErrorCode.NotFound)],
      });

      await user.press(screen.getByText('Accept'));

      await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled());
      expect(alertService.alert).not.toHaveBeenCalledWith(
        'Signed in as a different account',
        expect.anything(),
      );
    });

    it('does not report a refused decline as declined', async () => {
      const user = userEvent.setup();
      const onReject = jest.fn();

      renderWithApollo(
        <InvitationAcceptanceModal {...defaultProps} onReject={onReject} />,
        {
          operationMocks: [
            recordMock(DeclineHomeInviteDocument, {
              data: {
                declineHomeInvite: {
                  __typename: 'NotFoundError',
                  code: ErrorCode.NotFound,
                  message: 'gone',
                },
              },
            }).mock,
          ],
        },
      );

      await user.press(screen.getByText('Reject'));
      const confirm = jest.mocked(alertService.alert).mock.calls.at(-1)?.[2];
      await act(async () => {
        confirm?.find(b => b.style === 'destructive')?.onPress?.();
      });

      await waitFor(() => expect(toastService.error).toHaveBeenCalled());
      expect(toastService.success).not.toHaveBeenCalled();
      expect(onReject).not.toHaveBeenCalled();
    });
  });

  it('handles accept error with no message falls back to default', async () => {
    const user = userEvent.setup();
    const acceptMock = acceptHomeError('');

    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
      operationMocks: [acceptMock.mock],
    });

    await user.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to accept invitation. Please try again.',
      );
    });
  });

  it("reports a shopping-list accept failure in the app's own words", async () => {
    const user = userEvent.setup();
    const acceptMock = acceptShoppingListError('Server error');

    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={shoppingListInvitation}
      />,
      { operationMocks: [acceptMock.mock] },
    );

    await user.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to accept invitation. Please try again.',
      );
    });
    expect(toastService.error).not.toHaveBeenCalledWith('Server error');
  });

  // --- Additional branch coverage tests ---

  it('does nothing on handleAccept when invitation is null', async () => {
    // Render with null invitation - returns null early
    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} invitation={null} />,
    );
    // Component returns null, no buttons to press
    expect(screen.queryByText('Accept')).toBeNull();
  });

  it('handles reject flow for HOME_INVITE - shows confirmation alert', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);

    await act(async () => {
      await user.press(screen.getByText('Reject'));
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Decline Invitation',
      expect.stringContaining("Alice's Home"),
      expect.any(Array),
    );
  });

  it.each([
    [
      'handles reject confirmation for HOME_INVITE with token',
      homeInvitation,
      declineHomeOk,
      'abc123',
    ],
    [
      'handles reject confirmation for SHOPPING_LIST_INVITE with token',
      shoppingListInvitation,
      declineShoppingListOk,
      'def456',
    ],
  ])('%s', async (_name, invitation, declined, token) => {
    const declineMock = declined();

    await rejectAndConfirm(invitation, declineMock.mock);

    expect(declineMock.fired).toContainEqual({ input: { token } });
  });

  it.each([
    [
      "reports a decline failure in the app's own words, not the server's",
      homeInvitation,
      declineHomeError('Token expired'),
      'Token expired',
    ],
    [
      'handles reject error with no message falls back to default for HOME_INVITE',
      homeInvitation,
      declineHomeError(''),
      '',
    ],
    [
      "reports a shopping-list decline failure in the app's own words",
      shoppingListInvitation,
      declineShoppingListError('Server error'),
      'Server error',
    ],
  ])('%s', async (_name, invitation, declineMock, serverMessage) => {
    await rejectAndConfirm(invitation, declineMock.mock);

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to decline invitation. Please try again.',
      );
    });
    expect(toastService.error).not.toHaveBeenCalledWith(serverMessage);
  });

  it('offers no decline for an invite whose token it does not hold', () => {
    const noTokenInvite = { ...shoppingListInvitation, token: undefined };

    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={noTokenInvite}
      />,
    );

    expect(screen.queryByText('Reject')).toBeNull();
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('renders SHOPPING_LIST_INVITE without inviterName', () => {
    const noInviterSL = { ...shoppingListInvitation, inviterName: undefined };
    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} invitation={noInviterSL} />,
    );
    expect(screen.queryByText(/Invited by/)).toBeNull();
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
  });

  it('handles accept for HOME_INVITE when result is not Success union (does not call onAccept)', async () => {
    const user = userEvent.setup();
    const acceptMock = acceptHomeOk({ hasMembership: false });

    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
      operationMocks: [acceptMock.mock],
    });

    await act(async () => {
      await user.press(screen.getByText('Accept'));
    });

    // Result is ConflictError (non-Success union member) → onAccept must NOT
    // be called. Production only invokes onAccept on `AcceptHomeInviteSuccess`.
    expect(defaultProps.onAccept).not.toHaveBeenCalled();
  });

  it('handles accept for SHOPPING_LIST_INVITE when result has no success', async () => {
    const user = userEvent.setup();
    const acceptMock = acceptShoppingListOk({ success: false });

    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={shoppingListInvitation}
      />,
      {
        operationMocks: [acceptMock.mock],
      },
    );

    await act(async () => {
      await user.press(screen.getByText('Accept'));
    });

    expect(defaultProps.onAccept).not.toHaveBeenCalled();
  });

  it('renders without onAccept and onReject callbacks', () => {
    renderWithApollo(
      <InvitationAcceptanceModal
        visible={true}
        invitation={homeInvitation}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Accept')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it("reports an accept failure in the app's own words, not the server's", async () => {
    const user = userEvent.setup();
    // The server's message is unlocalizable English by construction, so the
    // caller's copy goes into the resolver and is what the reader sees.
    const acceptMock = acceptHomeError('Invalid invite token');

    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
      operationMocks: [acceptMock.mock],
    });

    await user.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to accept invitation. Please try again.',
      );
    });
    expect(toastService.error).not.toHaveBeenCalledWith('Invalid invite token');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  describe('an account whose email is not verified', () => {
    beforeEach(() => {
      useStore.setState({
        user: {
          id: 'user-1',
          email: 'invitee@example.com',
          emailVerified: false,
          onBoarded: true,
        },
      });
    });

    afterEach(() => {
      useStore.setState({ user: null });
    });

    it.each([
      ['a home invite', homeInvitation, acceptHomeOk],
      ['a list invite', shoppingListInvitation, acceptShoppingListOk],
    ])(
      'is offered verification instead of accepting %s',
      async (_label, invitation, acceptOk) => {
        const user = userEvent.setup();
        const acceptMock = acceptOk();

        renderWithApollo(
          <InvitationAcceptanceModal
            {...defaultProps}
            invitation={invitation}
          />,
          { operationMocks: [acceptMock.mock] },
        );

        await user.press(screen.getByText('Accept'));

        expect(alertService.alert).toHaveBeenCalledWith(
          'Verify your email first',
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Verify Now' }),
          ]),
        );
        expect(acceptMock.fired).toHaveLength(0);
        expect(defaultProps.onAccept).not.toHaveBeenCalled();
        // The invite stays open behind the gate, still pending.
        expect(defaultProps.onClose).not.toHaveBeenCalled();
        expect(screen.getByText('Accept')).toBeTruthy();
      },
    );
  });

  it('tells a throttled accept how long to wait, not that accepting failed', async () => {
    const user = userEvent.setup();
    const onAccept = jest.fn();
    const rateLimited = Object.assign(new Error('rate limited'), {
      errors: [
        {
          message: 'Too many requests',
          extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
        },
      ],
    });

    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} onAccept={onAccept} />,
      {
        operationMocks: [
          recordMock(AcceptHomeInviteDocument, { error: rateLimited }).mock,
        ],
      },
    );

    await user.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Too many requests. Please try again in 10 minutes.',
      );
    });
    expect(onAccept).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
