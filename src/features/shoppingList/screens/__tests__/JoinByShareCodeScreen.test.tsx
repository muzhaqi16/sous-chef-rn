import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { JoinShoppingListByShareCodeDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { JoinByShareCodeScreen } from '../JoinByShareCodeScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('#components/organisms/Header', () => ({ Header: () => null }));

jest.mock('#hooks/deepLink/useJoinLinkAuthGate', () => ({
  useJoinLinkAuthGate: () => false,
}));

jest.mock('#hooks/auth/useEmailVerification', () => ({
  useVerifiedEmailGate: () => ({
    requireVerifiedEmail: () => true,
    hasUnverifiedEmail: false,
  }),
}));

const mockGoBack = jest.fn();
const mockToShoppingListMain = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    goBack: mockGoBack,
    toShoppingListMain: mockToShoppingListMain,
  }),
}));

const CODE = 'ABC123';
const route = {
  key: 'JoinByShareCode-1',
  name: 'JoinByShareCode',
  params: { shareCode: CODE },
};

const rateLimited = () =>
  Object.assign(new Error('rate limited'), {
    errors: [
      {
        message: 'Too many requests',
        extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
      },
    ],
  });

const pressJoin = async () => {
  const user = userEvent.setup();
  await user.press(screen.getByText('Join List'));
};

beforeEach(() => jest.clearAllMocks());

describe('JoinByShareCodeScreen', () => {
  it('tells a throttled join how long to wait, not that the code is bad', async () => {
    const { mock, fired } = recordMock(JoinShoppingListByShareCodeDocument, {
      error: rateLimited(),
    });
    renderWithApollo(<JoinByShareCodeScreen route={route} />, {
      operationMocks: [mock],
    });

    await pressJoin();

    await waitFor(() =>
      expect(toastService.error).toHaveBeenCalledWith(
        'Too many requests. Please try again in 10 minutes.',
      ),
    );
    expect(fired).toEqual([{ input: { shareCode: CODE } }]);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('says the code may be invalid when no list has it', async () => {
    const { mock } = recordMock(JoinShoppingListByShareCodeDocument, {
      data: {
        joinShoppingListByShareCode: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'ShoppingList not found',
          resource: 'ShoppingList',
        },
      },
    });
    renderWithApollo(<JoinByShareCodeScreen route={route} />, {
      operationMocks: [mock],
    });

    await pressJoin();

    await waitFor(() =>
      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to join list. The code may be invalid or expired.',
      ),
    );
    expect(mockToShoppingListMain).not.toHaveBeenCalled();
  });

  it('opens the joined list', async () => {
    const { mock } = recordMock(JoinShoppingListByShareCodeDocument, {
      data: {
        joinShoppingListByShareCode: {
          __typename: 'JoinShoppingListByShareCodePayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-9',
            name: 'Party',
          },
        },
      },
    });
    renderWithApollo(<JoinByShareCodeScreen route={route} />, {
      operationMocks: [mock],
    });

    await pressJoin();

    await waitFor(() => expect(mockToShoppingListMain).toHaveBeenCalled());
    expect(mockGoBack).toHaveBeenCalled();
    expect(toastService.error).not.toHaveBeenCalled();
    expect(toastService.success).toHaveBeenCalledWith(
      expect.stringContaining('Party'),
    );
  });
});
