'use no memo';

import React from 'react';
import { waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { ResolveShareLinkDocument } from '../JoinByLinkScreen.generated';
import { JoinByLinkScreen } from '../JoinByLinkScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockDispatch = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn((name: string, params: unknown) => ({
  type: 'REPLACE',
  payload: { name, params },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    dispatch: mockDispatch,
    goBack: mockGoBack,
  })),
  StackActions: {
    replace: (name: string, params: unknown) => mockReplace(name, params),
  },
}));

jest.mock('#components/organisms/Header', () => ({ Header: () => null }));

const makeRoute = (code?: string) => ({
  key: 'JoinByLink-1',
  name: 'JoinByLink' as const,
  params: code ? { code } : {},
});

function buildResolveMock(
  code: string,
  result: {
    targetType: 'HOME_JOIN' | 'LIST_JOIN';
    homeId?: string;
    listId?: string;
  } | null,
): MockedResponse {
  return {
    request: { query: ResolveShareLinkDocument, variables: { code } },
    result: {
      data: {
        resolveShareLink: result
          ? {
              __typename: 'ResolveShareLinkResult',
              targetType: result.targetType,
              homeId: result.homeId ?? null,
              listId: result.listId ?? null,
              name: 'Resolved',
              alreadyMember: false,
            }
          : null,
      },
    },
    maxUsageCount: 10,
  };
}

describe('JoinByLinkScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('routes a HOME_JOIN code to the JoinHomeByCode screen', async () => {
    renderWithApollo(<JoinByLinkScreen route={makeRoute('HOME9')} />, {
      operationMocks: [buildResolveMock('HOME9', { targetType: 'HOME_JOIN' })],
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('JoinHomeByCode', {
        joinCode: 'HOME9',
      }),
    );
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('routes a LIST_JOIN code to the JoinByShareCode screen', async () => {
    renderWithApollo(<JoinByLinkScreen route={makeRoute('LIST9')} />, {
      operationMocks: [buildResolveMock('LIST9', { targetType: 'LIST_JOIN' })],
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('JoinByShareCode', {
        shareCode: 'LIST9',
      }),
    );
  });

  it('shows an invalid-link state when the code resolves to null', async () => {
    const tree = renderWithApollo(
      <JoinByLinkScreen route={makeRoute('BADCODE')} />,
      { operationMocks: [buildResolveMock('BADCODE', null)] },
    );
    await waitFor(() => expect(tree.getByText('Link not found')).toBeTruthy());
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
