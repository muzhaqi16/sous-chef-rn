import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { ShareShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { alertService } from '#/services/alertService';
import { ShareCodeSection } from '../ShareCodeSection';

jest.mock('#hooks/auth/useEmailVerification', () => ({
  useVerifiedEmailGate: () => ({
    requireVerifiedEmail: () => true,
    hasUnverifiedEmail: false,
  }),
}));

const rateLimited = () =>
  Object.assign(new Error('rate limited'), {
    errors: [
      {
        message: 'Too many requests',
        extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
      },
    ],
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => jest.clearAllMocks());

describe('ShareCodeSection', () => {
  it('tells a throttled toggle how long to wait, not that sharing failed', async () => {
    const user = userEvent.setup();
    const { mock, fired } = recordMock(ShareShoppingListDocument, {
      error: rateLimited(),
    });
    renderWithApollo(
      <ShareCodeSection listId="list-1" isPublic={false} shareCode={null} />,
      { operationMocks: [mock] },
    );

    await user.press(screen.getByText('Public sharing disabled'));

    await drainTimers();
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Too many requests. Please try again in 10 minutes.',
    );
    expect(fired).toEqual([{ input: { id: 'list-1', isPublic: true } }]);
  });

  it("reports a failure it has no code for in the section's own words", async () => {
    const user = userEvent.setup();
    const { mock } = recordMock(ShareShoppingListDocument, {
      error: new Error('Network request failed'),
    });
    renderWithApollo(
      <ShareCodeSection listId="list-1" isPublic={false} shareCode={null} />,
      { operationMocks: [mock] },
    );

    await user.press(screen.getByText('Public sharing disabled'));

    await drainTimers();
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update share settings',
    );
  });

  it('says nothing when the change applies', async () => {
    const user = userEvent.setup();
    const { mock, fired } = recordMock(ShareShoppingListDocument, {
      data: {
        shareShoppingList: {
          __typename: 'ShareShoppingListPayload',
          shoppingList: {
            id: 'list-1',
            isPublic: true,
            shareCode: 'ABC123',
          },
        },
      },
    });
    renderWithApollo(
      <ShareCodeSection listId="list-1" isPublic={false} shareCode={null} />,
      { operationMocks: [mock] },
    );

    await user.press(screen.getByText('Public sharing disabled'));

    await drainTimers();
    expect(fired).toHaveLength(1);
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});
