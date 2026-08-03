'use no memo';

import React from 'react';
import { userEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetHomeByJoinCodeDocument,
  JoinHomeByCodeDocument,
} from '#operations/home/home.generated';
import { JoinHomeByCodeScreen } from '../JoinHomeByCodeScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockGoBack = jest.fn();
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

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ goBack: mockGoBack })),
}));

const mockToPantryMain = jest.fn();
const mockToAuth = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: jest.fn(() => ({
    toPantryMain: mockToPantryMain,
    toAuth: mockToAuth,
  })),
}));

const mockUseIsLoggedOut = jest.fn(() => false);
jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => mockUseIsLoggedOut(),
}));

const mockSetSelectedHomeId = jest.fn();
const mockSetPendingDeepLinkAction = jest.fn();
jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      setSelectedHomeId: mockSetSelectedHomeId,
      setPendingDeepLinkAction: mockSetPendingDeepLinkAction,
    }),
    // HapticService.initialize subscribes to hapticFeedbackEnabled on first
    // trigger; provide a no-op so the join→navigate→haptic path doesn't depend
    // on cross-test init order.
    subscribe: () => () => {},
  },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('#components/molecules/Header', () => ({
  Header: () => null,
}));

// `route` prop shape for a static screen.
const makeRoute = (joinCode?: string) => ({
  key: 'JoinHomeByCode-1',
  name: 'JoinHomeByCode' as const,
  params: joinCode ? { joinCode } : {},
});

function buildPreviewMock(
  joinCode: string,
  home: {
    id?: string;
    name?: string;
    members?: number;
    pantries?: number;
  } | null,
): MockedResponse {
  return {
    request: { query: GetHomeByJoinCodeDocument, variables: { joinCode } },
    result: {
      data: {
        homeByJoinCode: home
          ? {
              __typename: 'Home',
              id: home.id ?? 'home-1',
              name: home.name ?? 'Family Home',
              isDefault: false,
              membersConnection: {
                __typename: 'MembershipConnection',
                totalCount: home.members ?? 2,
              },
              pantriesConnection: {
                __typename: 'PantryConnection',
                totalCount: home.pantries ?? 1,
                edges: [
                  {
                    __typename: 'PantryEdge',
                    node: {
                      __typename: 'Pantry',
                      id: 'pantry-1',
                      name: 'Kitchen',
                      isDefault: true,
                    },
                  },
                ],
              },
            }
          : null,
      },
    },
    maxUsageCount: 10,
  };
}

function buildJoinMock(joinCode: string): MockedResponse {
  return {
    request: {
      query: JoinHomeByCodeDocument,
      variables: { input: { joinCode } },
    },
    result: {
      data: {
        joinHomeByCode: {
          __typename: 'JoinHomeByCodePayload',
          membership: {
            __typename: 'Membership',
            id: 'membership-1',
            homeId: 'home-1',
            userId: 'user-1',
            role: 'MEMBER',
            status: 'ACTIVE',
            canManageHome: false,
            canViewPantry: true,
            canEditPantry: true,
            canAddItems: true,
            canRemoveItems: true,
            canInviteOthers: false,
            user: {
              __typename: 'User',
              id: 'user-1',
              email: 'me@test.com',
            },
          },
        },
      },
    },
    maxUsageCount: 10,
  };
}

describe('JoinHomeByCodeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLoggedOut.mockReturnValue(false);
  });

  it('queues the code and redirects to auth when logged out', async () => {
    mockUseIsLoggedOut.mockReturnValue(true);
    renderWithApollo(<JoinHomeByCodeScreen route={makeRoute('ABC123')} />, {
      operationMocks: [],
    });
    await waitFor(() => expect(mockToAuth).toHaveBeenCalled());
    expect(mockSetPendingDeepLinkAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'join_home', code: 'ABC123' }),
    );
  });

  it('renders manual entry when no joinCode is provided', () => {
    const tree = renderWithApollo(
      <JoinHomeByCodeScreen route={makeRoute()} />,
      {
        operationMocks: [],
      },
    );
    expect(tree.getByText('Enter Join Code')).toBeTruthy();
    expect(tree.getByText('Find Home')).toBeTruthy();
  });

  it('shows the home preview for a deep-link code', async () => {
    const tree = renderWithApollo(
      <JoinHomeByCodeScreen route={makeRoute('ABC123')} />,
      {
        operationMocks: [
          buildPreviewMock('ABC123', { members: 2, pantries: 1 }),
        ],
      },
    );
    await waitFor(() => expect(tree.getByText('Family Home')).toBeTruthy());
    expect(tree.getByText('Join Home')).toBeTruthy();
    expect(tree.getByText(/2 members · 1 pantry/)).toBeTruthy();
  });

  it('shows "Home not found" when the code resolves to null', async () => {
    const tree = renderWithApollo(
      <JoinHomeByCodeScreen route={makeRoute('BADCODE')} />,
      { operationMocks: [buildPreviewMock('BADCODE', null)] },
    );
    await waitFor(() => expect(tree.getByText('Home not found')).toBeTruthy());
  });

  it('joins the home and navigates to the pantry on confirm', async () => {
    const { toastService } = require('#/services/toastService');
    const user = userEvent.setup();
    const tree = renderWithApollo(
      <JoinHomeByCodeScreen route={makeRoute('ABC123')} />,
      {
        operationMocks: [
          buildPreviewMock('ABC123', { members: 2, pantries: 1 }),
          buildJoinMock('ABC123'),
        ],
      },
    );
    await waitFor(() => expect(tree.getByText('Join Home')).toBeTruthy());
    await user.press(tree.getByText('Join Home'));

    await waitFor(() =>
      expect(mockSetSelectedHomeId).toHaveBeenCalledWith('home-1'),
    );
    expect(mockToPantryMain).toHaveBeenCalled();
    expect(toastService.success).toHaveBeenCalledWith('Joined "Family Home"');
  });
});
