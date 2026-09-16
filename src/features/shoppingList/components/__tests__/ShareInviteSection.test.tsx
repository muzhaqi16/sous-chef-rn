import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { AddCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { ShareInviteSection } from '../ShareInviteSection';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#hooks/auth/useEmailVerification', () => ({
  useVerifiedEmailGate: () => ({
    requireVerifiedEmail: () => true,
    hasUnverifiedEmail: false,
  }),
}));

const EMAIL = 'friend@example.com';

const rateLimited = () =>
  Object.assign(new Error('rate limited'), {
    errors: [
      {
        message: 'Too many requests',
        extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
      },
    ],
  });

const sendInvite = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('e.g. john@example.com'), EMAIL);
  await user.press(screen.getByLabelText('Invite Members'));
};

beforeEach(() => jest.clearAllMocks());

describe('ShareInviteSection', () => {
  it('tells a throttled invite how long to wait, not that sending failed', async () => {
    const { mock, fired } = recordMock(AddCollaboratorDocument, {
      error: rateLimited(),
    });
    renderWithApollo(<ShareInviteSection listId="list-1" />, {
      operationMocks: [mock],
    });

    await sendInvite();

    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Too many requests. Please try again in 10 minutes.',
      ),
    );
    expect(fired).toEqual([
      {
        input: {
          shoppingListId: 'list-1',
          email: EMAIL,
          role: CollaboratorRole.Contributor,
        },
      },
    ]);
    expect(screen.getByDisplayValue(EMAIL)).toBeTruthy();
  });

  it('clears the address once the invite is sent, saying nothing', async () => {
    const { mock } = recordMock(AddCollaboratorDocument, {
      data: {
        inviteToShoppingList: {
          __typename: 'InviteToShoppingListPayload',
          collaborator: { __typename: 'ShoppingListCollaborator', id: 'c-1' },
        },
      },
    });
    renderWithApollo(<ShareInviteSection listId="list-1" />, {
      operationMocks: [mock],
    });

    await sendInvite();

    await waitFor(() => expect(screen.queryByDisplayValue(EMAIL)).toBeNull());
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});
