'use no memo';

import React from 'react';
import { ShareLinkTargetType } from '#/graphql/generated/schemaTypes';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { ResolveShareLinkDocument } from '#operations/home/home.generated';
import { JoinByLinkScreen } from '../JoinByLinkScreen';

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
    targetType: ShareLinkTargetType;
    homeId?: string;
    listId?: string;
  } | null,
): MockFor<typeof ResolveShareLinkDocument> {
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('JoinByLinkScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('routes a HOME_JOIN code to the JoinHomeByCode screen', async () => {
    renderWithApollo(<JoinByLinkScreen route={makeRoute('HOME9')} />, {
      operationMocks: [
        buildResolveMock('HOME9', { targetType: ShareLinkTargetType.HomeJoin }),
      ],
    });
    await drainTimers();
    expect(mockReplace).toHaveBeenCalledWith('JoinHomeByCode', {
      joinCode: 'HOME9',
    });
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('routes a LIST_JOIN code to the JoinByShareCode screen', async () => {
    renderWithApollo(<JoinByLinkScreen route={makeRoute('LIST9')} />, {
      operationMocks: [
        buildResolveMock('LIST9', { targetType: ShareLinkTargetType.ListJoin }),
      ],
    });
    await drainTimers();
    expect(mockReplace).toHaveBeenCalledWith('JoinByShareCode', {
      shareCode: 'LIST9',
    });
  });

  it('shows an invalid-link state when the code resolves to null', async () => {
    const tree = renderWithApollo(
      <JoinByLinkScreen route={makeRoute('BADCODE')} />,
      { operationMocks: [buildResolveMock('BADCODE', null)] },
    );
    await drainTimers();
    expect(tree.getByText('Link not found')).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
