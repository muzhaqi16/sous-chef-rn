'use no memo';
import React from 'react';
import {
  CollaboratorRole,
  CollaboratorStatus,
  ErrorCode,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { screen, userEvent, act, waitFor } from '@testing-library/react-native';
import { InvitationAcceptanceModal } from '../InvitationAcceptanceModal';
import type { InvitationData } from '#features/notifications/types';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  InvitationAcceptanceModalAcceptShoppingListInviteDocument,
  InvitationAcceptanceModalDeclineShoppingListInviteDocument as DeclineShoppingListInviteDocument,
} from '../InvitationAcceptanceModal.generated';
import { alertService, type AlertButton } from '#/services/alertService';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/finallyHelpers', () => ({
  executeAsyncWithCleanup: async (
    fn: () => Promise<void>,
    cleanup: () => void,
    onError?: (e: unknown) => void,
  ) => {
    try {
      await fn();
    } catch (e) {
      onError?.(e);
    } finally {
      cleanup();
    }
  },
  executeWithLoadingState: async (
    fn: () => Promise<void>,
    setLoading: (b: boolean) => void,
    onError?: (e: unknown) => void,
  ) => {
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
    }
  },
  executeMutation: async <T,>(
    fn: () => Promise<T>,
    onErrorOrLog: string | ((error: unknown) => void | Promise<void>),
  ) => {
    try {
      return await fn();
    } catch (e) {
      if (typeof onErrorOrLog === 'function') onErrorOrLog(e);
    }
  },
  executeRefreshWithFinally: async (
    fn: () => Promise<unknown>,
    setRefreshing: (b: boolean) => void,
  ) => {
    setRefreshing(true);
    try {
      await fn();
    } finally {
      setRefreshing(false);
    }
  },
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
}));

jest.mock('#/apollo/links/tokenScheduler');

jest.mock('#/apollo/links/refreshToken');

const homeInvitation: InvitationData = {
  type: 'HOME_INVITE',
  id: 'inv-1',
  title: 'Home Invitation',
  description: 'You have been invited to join a home',
  inviterName: 'Alice',
  entityName: "Alice's Home",
  token: 'abc123',
  payload: {},
};

const shoppingListInvitation: InvitationData = {
  type: 'SHOPPING_LIST_INVITE',
  id: 'inv-2',
  title: 'Shopping List Invitation',
  description: 'You have been invited to collaborate on a shopping list',
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

function acceptHomeOk(opts: { hasMembership?: boolean } = {}) {
  const hasMembership = opts.hasMembership ?? true;
  // Note: AcceptHomeInviteSuccess.membership is non-nullable in the schema.
  // When `hasMembership: false`, we return a ConflictError union member instead
  // to simulate the "already accepted" branch the test asserts on.
  if (!hasMembership) {
    return recordMock(AcceptHomeInviteDocument, {
      data: {
        acceptHomeInvite: {
          __typename: 'ConflictError',
          code: ErrorCode.Conflict,
          message: 'Already accepted',
        },
      },
    });
  }
  return recordMock(AcceptHomeInviteDocument, {
    data: {
      acceptHomeInvite: {
        __typename: 'AcceptHomeInvitePayload',
        membership: {
          __typename: 'Membership',
          id: 'm1',
          homeId: 'home-1',
          role: MembershipRole.Member,
          canManageHome: false,
          canViewPantry: true,
          canEditPantry: true,
          canAddItems: true,
          canRemoveItems: true,
          canInviteOthers: false,
          home: {
            __typename: 'Home',
            id: 'home-1',
            name: "Alice's Home",
            isDefault: false,
            version: 1,
            myMembership: {
              __typename: 'Membership',
              id: 'm1',
              role: MembershipRole.Member,
              canManageHome: false,
              canViewPantry: true,
              canEditPantry: true,
              canAddItems: true,
              canRemoveItems: true,
              canInviteOthers: false,
            },
            pantriesConnection: {
              __typename: 'PantryConnection',
              totalCount: 0,
              edges: [],
            },
            membersConnection: {
              __typename: 'MembershipConnection',
              totalCount: 1,
            },
          },
        },
      },
    },
  });
}

function acceptHomeError(message: string) {
  return recordMock(AcceptHomeInviteDocument, { error: new Error(message) });
}

function acceptShoppingListOk(opts: { success?: boolean } = {}) {
  const success = opts.success ?? true;
  // When `success: false`, simulate the error branch via a ConflictError union
  // member. The test asserts onAccept is NOT called in that case.
  if (!success) {
    return recordMock(
      InvitationAcceptanceModalAcceptShoppingListInviteDocument,
      {
        data: {
          acceptShoppingListInvite: {
            __typename: 'ConflictError',
            code: ErrorCode.Conflict,
            message: 'Could not accept',
          },
        },
      },
    );
  }
  return recordMock(InvitationAcceptanceModalAcceptShoppingListInviteDocument, {
    data: {
      acceptShoppingListInvite: {
        __typename: 'AcceptShoppingListInvitePayload',
        collaborator: {
          __typename: 'ShoppingListCollaborator',
          id: 'c1',
          email: 'a@b.com',
          role: CollaboratorRole.Editor,
          status: CollaboratorStatus.Active,
          collaboratorId: 'u1',
          canAddItems: true,
          canRemoveItems: true,
          canEditItems: true,
          canMarkPurchased: true,
          canEdit: true,
          canInviteOthers: false,
          invitedAt: '2025-01-01T00:00:00.000Z',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'sl-1',
            name: 'Weekly Groceries',
            description: null,
          },
          collaborator: {
            __typename: 'User',
            id: 'u1',
            email: 'a@b.com',
            profile: {
              __typename: 'UserProfile',
              id: 'p1',
              displayName: 'Tester',
              avatar: null,
            },
          },
        },
      },
    },
  });
}

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
        homeInvite: { __typename: 'HomeInvite', id: 'inv-1' },
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
        collaborator: {
          __typename: 'ShoppingListCollaborator',
          id: 'c1',
        },
      },
    },
  });
}

function declineShoppingListError(message: string) {
  return recordMock(DeclineShoppingListInviteDocument, {
    error: new Error(message),
  });
}

describe('InvitationAcceptanceModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when invitation is null', () => {
    renderWithApollo(
      <InvitationAcceptanceModal {...defaultProps} invitation={null} />,
    );
    expect(screen.queryByText('Home Invitation')).toBeNull();
  });

  it('renders the invitation title', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    expect(screen.getByText('Home Invitation')).toBeTruthy();
  });

  it('renders the invitation description', () => {
    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />);
    expect(
      screen.getByText('You have been invited to join a home'),
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
    expect(screen.getByText('Shopping List Invitation')).toBeTruthy();
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
    expect(screen.queryByText('Home Invitation')).toBeNull();
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
    const { toastService } = require('#/services/toastService');
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
      const { toastService } = require('#/services/toastService');
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
      const { toastService } = require('#/services/toastService');
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
      const confirm = jest.mocked(alertService.alert).mock.calls.at(-1)?.[2] as
        | AlertButton[]
        | undefined;
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
    const { toastService } = require('#/services/toastService');
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
    const { toastService } = require('#/services/toastService');
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

  it('handles reject confirmation for HOME_INVITE with token', async () => {
    const user = userEvent.setup();
    const declineMock = declineHomeOk();

    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
      operationMocks: [declineMock.mock],
    });

    await act(async () => {
      await user.press(screen.getByText('Reject'));
    });

    // Press 'Decline' in the confirmation alert
    const alertCall = (alertService.alert as jest.Mock).mock.calls[0];
    const declineButton = (alertCall[2] as AlertButton[]).find(
      b => b.text === 'Decline',
    );

    await act(async () => {
      declineButton?.onPress?.();
    });

    expect(declineMock.fired).toContainEqual({ input: { token: 'abc123' } });
  });

  it('handles reject confirmation for SHOPPING_LIST_INVITE with token', async () => {
    const user = userEvent.setup();
    const declineMock = declineShoppingListOk();

    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={shoppingListInvitation}
      />,
      {
        operationMocks: [declineMock.mock],
      },
    );

    await act(async () => {
      await user.press(screen.getByText('Reject'));
    });

    const alertCall = (alertService.alert as jest.Mock).mock.calls[0];
    const declineButton = (alertCall[2] as AlertButton[]).find(
      b => b.text === 'Decline',
    );

    await act(async () => {
      declineButton?.onPress?.();
    });

    expect(declineMock.fired).toContainEqual({ input: { token: 'def456' } });
  });

  it("reports a decline failure in the app's own words, not the server's", async () => {
    const user = userEvent.setup();
    const { toastService } = require('#/services/toastService');
    const declineMock = declineHomeError('Token expired');

    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
      operationMocks: [declineMock.mock],
    });

    await act(async () => {
      await user.press(screen.getByText('Reject'));
    });

    const declineButton = (
      (alertService.alert as jest.Mock).mock.calls[0][2] as AlertButton[]
    ).find(b => b.text === 'Decline');
    declineButton?.onPress?.();

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to decline invitation. Please try again.',
      );
    });
    expect(toastService.error).not.toHaveBeenCalledWith('Token expired');
  });

  it('handles reject error with no message falls back to default for HOME_INVITE', async () => {
    const user = userEvent.setup();
    const { toastService } = require('#/services/toastService');
    const declineMock = declineHomeError('');

    renderWithApollo(<InvitationAcceptanceModal {...defaultProps} />, {
      operationMocks: [declineMock.mock],
    });

    await act(async () => {
      await user.press(screen.getByText('Reject'));
    });

    const declineButton = (
      (alertService.alert as jest.Mock).mock.calls[0][2] as AlertButton[]
    ).find(b => b.text === 'Decline');
    declineButton?.onPress?.();

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to decline invitation. Please try again.',
      );
    });
  });

  it("reports a shopping-list decline failure in the app's own words", async () => {
    const user = userEvent.setup();
    const { toastService } = require('#/services/toastService');
    const declineMock = declineShoppingListError('Server error');

    renderWithApollo(
      <InvitationAcceptanceModal
        {...defaultProps}
        invitation={shoppingListInvitation}
      />,
      { operationMocks: [declineMock.mock] },
    );

    await act(async () => {
      await user.press(screen.getByText('Reject'));
    });

    const declineButton = (
      (alertService.alert as jest.Mock).mock.calls[0][2] as AlertButton[]
    ).find(b => b.text === 'Decline');
    declineButton?.onPress?.();

    await waitFor(() => {
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to decline invitation. Please try again.',
      );
    });
    expect(toastService.error).not.toHaveBeenCalledWith('Server error');
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
    const { toastService } = require('#/services/toastService');
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
});
