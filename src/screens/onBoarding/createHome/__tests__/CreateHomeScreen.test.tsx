'use no memo';

import React from 'react';
import { userEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetHomesDocument,
  GetMyPendingInvitesDocument,
  CreateHomeDocument,
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#/services/alertService';
import type { RootState } from '#store/index';
import { CreateHomeScreen } from '../CreateHomeScreen';

let mockHasUnverifiedEmail = false;

jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
const mockSetUserNavigationState = jest.fn();
const mockSkipToStep = jest.fn();

jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    setUserNavigationState: mockSetUserNavigationState,
    skipToStep: mockSkipToStep,
  }),
}));

const mockSetSelectedHomeId = jest.fn();
const mockSetSelectedPantryId = jest.fn();

const mockUser = {
  id: 'user-1',
  email: 'user-1@test.com',
  emailVerified: true,
  onBoarded: true,
};

const mockBuildState = (overrides: Partial<RootState>): RootState =>
  ({
    user: mockUser,
    setSelectedHomeId: mockSetSelectedHomeId,
    setSelectedPantryId: mockSetSelectedPantryId,
    ...overrides,
  } as Partial<RootState> as RootState);

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(
    <T,>(selector: (state: RootState) => T): T =>
      selector(mockBuildState({ selectedHomeId: null })),
  ),
  useUser: jest.fn(() => mockUser),
  useSelectedHomeId: jest.fn(() => null),
  useSetSelectedPantryId: jest.fn(() => mockSetSelectedPantryId),
  useHasUnverifiedEmail: jest.fn(() => mockHasUnverifiedEmail),
}));

jest.mock('#/utils/validation/onboarding', () => ({
  getCreateHomeSchema: jest.fn(() => ({
    fields: {},
    validate: jest.fn(),
    cast: jest.fn(),
  })),
}));

jest.mock('../helpers', () => ({
  createPantryForHome: jest.fn().mockResolvedValue(true),
  showPantryCreationError: jest.fn(),
}));

// Per-test override slot for the homes that production code reads off the
// GetHomes connection. Tests call `stageHomes([…])` in place of the legacy
// `toHomeViewModels.mockReturnValue(…)` from before the view-model module
// was removed.
// Prefixed `mock*` so the jest.mock factory below is allowed to reference it.
type StagedPantryNode = {
  __typename?: string;
  id: string;
  name?: string;
  isDefault?: boolean;
};
type StagedHome = {
  id: string;
  name: string;
  pantriesConnection?: {
    __typename?: string;
    edges?: Array<{ __typename?: string; node?: StagedPantryNode } | null>;
    totalCount?: number;
  };
};
let mockStagedHomes: StagedHome[] | null = null;

/**
 * `extractNodes` flattens Relay-style connections in production. The mock
 * supports three shapes so existing fixtures keep working:
 *
 *   1. A real connection (`{ edges: [{ node }] }`) — normalize to nodes.
 *   2. A flat array — already in node form, return as-is.
 *   3. The GetHomes connection (or anything else) — return the test-staged
 *      homes if set; otherwise the default empty array.
 *
 * Tests that stage homes also pre-flatten each home's pantries onto a
 * `pantries` array; production reads `extractNodes(home.pantriesConnection)`,
 * so the mock surfaces `home.pantries` when `pantriesConnection` is absent.
 */
jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn((data: unknown) => {
    // When the input is a Connection-shape (has `edges`/`__typename`) and the
    // test staged homes, treat that input as the GetHomes connection and
    // return the staged data. Empty fixtures from `defaultOperationMocks`
    // would otherwise overwrite the staged value on a re-render.
    const asConnection = data as {
      __typename?: string;
      edges?: Array<{ node?: unknown } | null>;
    } | null;
    if (
      mockStagedHomes &&
      asConnection &&
      typeof asConnection === 'object' &&
      'edges' in asConnection &&
      (asConnection.__typename === 'HomeConnection' || !asConnection.__typename)
    ) {
      return mockStagedHomes;
    }
    if (!data) return mockStagedHomes ?? [];
    if (Array.isArray(asConnection?.edges)) {
      return asConnection.edges.map(e => e?.node).filter(Boolean);
    }
    if (Array.isArray(data)) return data;
    return [];
  }),
}));

function stageHomes(homes: StagedHome[]) {
  mockStagedHomes = homes;
}

jest.mock('#/components/providers/ScreenErrorBoundary', () => ({
  OnboardingErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/utils/finallyHelpers');

// Mock form components
jest.mock('../FormContent', () => ({
  FormContent: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="form-content">
        <Text>Form Content</Text>
      </View>
    );
  },
}));

jest.mock('../LoadingView', () => ({
  LoadingView: ({ onSkip }: { onSkip: () => void }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="loading-view">
        <Text>Loading...</Text>
        <Pressable onPress={onSkip}>
          <Text>Skip</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('#components/templates/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({
    title,
    subtitle,
    children,
    testID,
  }: {
    title?: string;
    subtitle?: string;
    children?: React.ReactNode;
    testID?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID || 'onboarding-wrapper'}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('../SubmitButton', () => ({
  SubmitButton: ({
    onPress,
    isCreating,
  }: {
    onPress: () => void;
    isCreating: boolean;
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="submit-button" onPress={onPress}>
        <Text>{isCreating ? 'Creating...' : 'Submit'}</Text>
      </Pressable>
    );
  },
}));

jest.mock('../ErrorMessage', () => ({
  ErrorMessage: ({ message }: { message: string }) => {
    const { Text } = require('react-native');
    return <Text testID="error-message">{message}</Text>;
  },
}));

jest.mock('#components/atoms/Button', () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID={`button-${title}`} onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#utils/formatters/roleFormatters', () => ({
  formatRole: jest.fn((role: string) => role),
}));

// Mock react-hook-form
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit:
      (fn: (values: { homeName: string; pantryName: string }) => void) => () =>
        fn({ homeName: 'My Home', pantryName: 'Kitchen' }),
    control: {},
    formState: { errors: {} },
    register: jest.fn(),
    setValue: jest.fn(),
    watch: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('@hookform/resolvers/yup', () => ({
  yupResolver: jest.fn(() => jest.fn()),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// --- Mock state used by tests to control query responses ---
type PendingInviteShape = {
  id: string;
  token: string;
  role: string;
  home: { name: string } | null;
  inviter: { email?: string; profile?: { displayName?: string } | null } | null;
};

let mockHomesData: { edges: unknown[] } = { edges: [] };
let mockHomesLoading = false;
let mockPendingInvites: PendingInviteShape[] = [];

// Records of mutation calls keyed by mutation name. Tests assert on these.
type RecordedMutation = { name: string; variables: Record<string, unknown> };
let recordedMutations: RecordedMutation[] = [];

// Per-mutation response control
let mockCreateHomeResponse: Record<string, unknown> = {
  createHome: {
    __typename: 'CreateHomePayload',
    home: {
      __typename: 'Home',
      id: 'home-default',
      name: 'My Home',
      isDefault: true,
      version: 1,
      pantriesConnection: {
        __typename: 'PantryConnection',
        totalCount: 0,
        edges: [],
      },
      myMembership: null,
    },
  },
};
let mockCreateHomeError: Error | null = null;

let mockAcceptHomeInviteResponse: Record<string, unknown> = {
  acceptHomeInvite: {
    __typename: 'AcceptHomeInvitePayload',
    membership: { __typename: 'Membership', id: 'm1', homeId: 'home-1' },
  },
};

let mockDeclineHomeInviteResponse: Record<string, unknown> = {
  declineHomeInvite: {
    __typename: 'DeclineHomeInvitePayload',
    homeInvite: { __typename: 'HomeInvite', id: 'invite-1' },
  },
};

function buildGetHomesMock(): MockedResponse {
  return {
    request: { query: GetHomesDocument, variables: () => true },
    maxUsageCount: 100,
    result: () => {
      if (mockHomesLoading) {
        // Simulate a never-resolving promise via delay won't work cleanly;
        // tests that need loading state set mockHomesLoading and assert on it
        // separately (they use `loading: true` semantics from useQuery, which
        // means the mock should not have responded yet). We achieve this by
        // resolving with empty data when not in loading state, and tests that
        // need `loading: true` use a special render path.
      }
      return {
        data: {
          __typename: 'Query',
          homes: {
            __typename: 'HomeConnection',
            totalCount: mockHomesData?.edges?.length ?? 0,
            edges: mockHomesData?.edges ?? [],
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      };
    },
  };
}

function buildGetMyPendingInvitesMock(): MockedResponse {
  return {
    request: { query: GetMyPendingInvitesDocument, variables: () => true },
    maxUsageCount: 100,
    result: () => ({
      data: {
        __typename: 'Query',
        me: {
          __typename: 'User',
          id: 'user-1',
          pendingHomeInvitesConnection: {
            __typename: 'HomeInviteConnection',
            edges: mockPendingInvites.map(invite => ({
              __typename: 'HomeInviteEdge',
              node: {
                __typename: 'HomeInvite',
                id: invite.id,
                token: invite.token,
                role: invite.role,
                home: invite.home
                  ? {
                      __typename: 'Home',
                      id: `home-for-${invite.id}`,
                      name: invite.home.name,
                    }
                  : null,
                inviter: invite.inviter
                  ? {
                      __typename: 'User',
                      id: `inviter-for-${invite.id}`,
                      email: invite.inviter.email ?? null,
                      profile: invite.inviter.profile
                        ? {
                            __typename: 'UserProfile',
                            id: `profile-for-${invite.id}`,
                            displayName:
                              invite.inviter.profile.displayName ?? null,
                            avatar: null,
                          }
                        : null,
                    }
                  : null,
              },
            })),
          },
        },
      },
    }),
  };
}

function buildCreateHomeMock(): MockedResponse {
  return {
    request: {
      query: CreateHomeDocument,
      variables: variables => {
        recordedMutations.push({ name: 'CreateHome', variables });
        return true;
      },
    },
    maxUsageCount: 100,
    ...(mockCreateHomeError
      ? { error: mockCreateHomeError }
      : { result: () => ({ data: mockCreateHomeResponse }) }),
  };
}

function buildCreatePantryMock(): MockedResponse {
  return {
    request: {
      query: CreatePantryDocument,
      variables: variables => {
        recordedMutations.push({ name: 'CreatePantry', variables });
        return true;
      },
    },
    maxUsageCount: 100,
    result: {
      data: {
        createPantry: {
          __typename: 'PantryPayload',
          success: true,
          message: null,
          code: null,
          pantry: {
            __typename: 'Pantry',
            id: 'p-new',
            name: 'Kitchen',
            isDefault: true,
            homeId: 'home-1',
          },
        },
      },
    },
  };
}

function buildAcceptHomeInviteMock(): MockedResponse {
  return {
    request: {
      query: AcceptHomeInviteDocument,
      variables: variables => {
        recordedMutations.push({ name: 'AcceptHomeInvite', variables });
        return true;
      },
    },
    maxUsageCount: 100,
    result: () => ({ data: mockAcceptHomeInviteResponse }),
  };
}

function buildDeclineHomeInviteMock(): MockedResponse {
  return {
    request: {
      query: DeclineHomeInviteDocument,
      variables: variables => {
        recordedMutations.push({ name: 'DeclineHomeInvite', variables });
        return true;
      },
    },
    maxUsageCount: 100,
    result: () => ({ data: mockDeclineHomeInviteResponse }),
  };
}

function defaultOperationMocks(): MockedResponse[] {
  return [
    buildGetHomesMock(),
    buildGetMyPendingInvitesMock(),
    buildCreateHomeMock(),
    buildCreatePantryMock(),
    buildAcceptHomeInviteMock(),
    buildDeclineHomeInviteMock(),
  ];
}

function renderScreen() {
  return renderWithApollo(<CreateHomeScreen />, {
    operationMocks: defaultOperationMocks(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset query state defaults
  mockHomesData = { edges: [] };
  mockHomesLoading = false;
  mockPendingInvites = [];
  recordedMutations = [];
  mockHasUnverifiedEmail = false;
  mockCreateHomeError = null;
  mockCreateHomeResponse = {
    createHome: {
      __typename: 'CreateHomePayload',
      home: {
        __typename: 'Home',
        id: 'home-default',
        name: 'My Home',
        isDefault: true,
        version: 1,
        pantriesConnection: {
          __typename: 'PantryConnection',
          totalCount: 0,
          edges: [],
        },
        myMembership: null,
      },
    },
  };
  mockAcceptHomeInviteResponse = {
    acceptHomeInvite: {
      __typename: 'AcceptHomeInvitePayload',
      membership: { __typename: 'Membership', id: 'm1', homeId: 'home-1' },
    },
  };
  mockDeclineHomeInviteResponse = {
    declineHomeInvite: {
      __typename: 'DeclineHomeInvitePayload',
      homeInvite: { __typename: 'HomeInvite', id: 'invite-1' },
    },
  };

  mockStagedHomes = null;

  const { formatRole } = require('#utils/formatters/roleFormatters');
  formatRole.mockImplementation((role: string) => role);
});

describe('CreateHomeScreen', () => {
  it('renders create home form when no existing home', async () => {
    const { findByText } = renderScreen();
    expect(await findByText("Welcome! Let's set up your home")).toBeTruthy();
  });

  it('shows form content', async () => {
    const { findByText } = renderScreen();
    expect(await findByText('Form Content')).toBeTruthy();
  });

  it('renders submit button', async () => {
    const { findByText } = renderScreen();
    expect(await findByText('Submit')).toBeTruthy();
  });

  it('shows loading view when checking existing resources', () => {
    // Give the GetHomes mock infinite delay so the screen stays in loading
    const loadingMocks: MockedResponse[] = [
      {
        request: { query: GetHomesDocument, variables: () => true },
        maxUsageCount: 100,
        delay: Number.POSITIVE_INFINITY,
        result: { data: undefined },
      },
      buildGetMyPendingInvitesMock(),
    ];
    const { getByTestId } = renderWithApollo(<CreateHomeScreen />, {
      operationMocks: loadingMocks,
    });
    expect(getByTestId('loading-view')).toBeTruthy();
  });

  it('shows existing resources when both home and pantry exist', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
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
          totalCount: 1,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(await findByText("You're all set!")).toBeTruthy();
    expect(await findByText('Continue')).toBeTruthy();
  });

  it('shows continue button for existing setup', async () => {
    const user = userEvent.setup();
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
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
          totalCount: 1,
        },
      },
    ]);

    const { findByText } = renderScreen();
    await user.press(await findByText('Continue'));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('CreateHome');
  });

  it('shows pending invites when available and no home', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: {
          email: 'john@test.com',
          profile: { displayName: 'John' },
        },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('You have pending home invitations!')).toBeTruthy();
    expect(await findByText('Johns Home')).toBeTruthy();
  });

  it('shows loading view when invites are loading', () => {
    // Same approach as the homes loading test
    const loadingMocks: MockedResponse[] = [
      {
        request: { query: GetHomesDocument, variables: () => true },
        maxUsageCount: 100,
        delay: Number.POSITIVE_INFINITY,
        result: { data: undefined },
      },
      buildGetMyPendingInvitesMock(),
    ];
    const { getByTestId } = renderWithApollo(<CreateHomeScreen />, {
      operationMocks: loadingMocks,
    });
    expect(getByTestId('loading-view')).toBeTruthy();
  });

  it('shows "Almost there!" title when home exists but no pantry', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [],
          totalCount: 0,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(await findByText('Almost there!')).toBeTruthy();
  });

  it('shows subtitle about adding pantry when home exists but no pantry', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [],
          totalCount: 0,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(await findByText("Let's add a pantry to My Home")).toBeTruthy();
  });

  it('shows correct subtitle when no home exists', async () => {
    const { findByText } = renderScreen();
    expect(
      await findByText('Create your home and pantry to get started'),
    ).toBeTruthy();
  });

  it('shows subtitle for existing setup', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
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
          totalCount: 1,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(
      await findByText('Your home and pantry are already configured'),
    ).toBeTruthy();
  });

  it('shows existing home name in resource card when home exists but pantry missing', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [],
          totalCount: 0,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(await findByText('Existing Home')).toBeTruthy();
    expect(await findByText('My Home')).toBeTruthy();
  });

  it('shows "Default" badge on default pantry in existing setup view', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
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
          totalCount: 1,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(await findByText('Default')).toBeTruthy();
  });

  it('does not show "Default" badge when pantry is not default', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [
            {
              __typename: 'PantryEdge',
              node: {
                __typename: 'Pantry',
                id: 'pantry-1',
                name: 'Kitchen',
                isDefault: false,
              },
            },
          ],
          totalCount: 1,
        },
      },
    ]);

    const { queryByText, findByText } = renderScreen();
    // Wait for any render to settle (look for "You're all set!" or other content)
    await findByText("You're all set!");
    expect(queryByText('Default')).toBeNull();
  });

  it('calls skipToStep when "Create My Own Home" is pressed on invites screen', async () => {
    const user = userEvent.setup();
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: {
          email: 'john@test.com',
          profile: { displayName: 'John' },
        },
      },
    ];

    const { findByText } = renderScreen();
    // Press "Skip for Now"
    await user.press(await findByText('Skip for Now'));
    expect(mockSkipToStep).toHaveBeenCalledWith('CreateShoppingList');
  });

  it('shows inviter display name when available', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: {
          email: 'john@test.com',
          profile: { displayName: 'John' },
        },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('John')).toBeTruthy();
  });

  it('shows inviter email when displayName is missing', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('john@test.com')).toBeTruthy();
  });

  it('shows "Someone" when inviter info is missing', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: null,
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('Someone')).toBeTruthy();
  });

  it('shows "Unknown Home" when home name is missing from invite', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: null,
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('Unknown Home')).toBeTruthy();
  });

  it('calls acceptHomeInvite when Accept button is pressed', async () => {
    const user = userEvent.setup();
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    await user.press(await findByText('Accept'));
    await waitFor(() => {
      expect(recordedMutations).toContainEqual({
        name: 'AcceptHomeInvite',
        variables: { input: { token: 'invite-1' } },
      });
    });
  });

  it('calls alertService.alert when Decline button is pressed', async () => {
    const user = userEvent.setup();
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    await user.press(await findByText('Decline'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Decline Invitation',
      expect.stringContaining('Johns Home'),
      expect.any(Array),
    );
  });

  it('submits form and calls createHome on submit', async () => {
    const user = userEvent.setup();
    mockCreateHomeResponse = {
      createHome: {
        __typename: 'CreateHomePayload',
        home: {
          __typename: 'Home',
          id: 'home-new',
          name: 'My Home',
          isDefault: true,
          version: 1,
          pantriesConnection: {
            __typename: 'PantryConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'PantryEdge',
                node: { __typename: 'Pantry', id: 'p1', isDefault: true },
              },
            ],
          },
          myMembership: null,
        },
      },
    };

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    // executeWithLoadingState was called
    const { executeWithLoadingState } = require('#/utils/finallyHelpers');
    await waitFor(() => {
      expect(executeWithLoadingState).toHaveBeenCalled();
    });
  });

  it('shows "Create My Own Home" button on invite view', async () => {
    const user = userEvent.setup();
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('Create My Own Home')).toBeTruthy();
    // Pressing it should show the create form
    await user.press(await findByText('Create My Own Home'));
  });

  it('selects first pantry as fallback when no default pantry exists', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [
            {
              __typename: 'PantryEdge',
              node: {
                __typename: 'Pantry',
                id: 'pantry-1',
                name: 'Kitchen',
                isDefault: false,
              },
            },
          ],
          totalCount: 1,
        },
      },
    ]);

    renderScreen();
    // syncExistingResources should call setSelectedHomeId and setSelectedPantryId
    await waitFor(() => {
      expect(mockSetSelectedHomeId).toHaveBeenCalledWith('home-1');
    });
    expect(mockSetSelectedPantryId).toHaveBeenCalledWith('pantry-1');
  });

  it('switches to create form after pressing "Create My Own Home" on invite view', async () => {
    const user = userEvent.setup();
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText, queryByText } = renderScreen();
    await user.press(await findByText('Create My Own Home'));
    // After pressing, should show create form instead of invites
    expect(await findByText("Welcome! Let's set up your home")).toBeTruthy();
    expect(queryByText('You have pending home invitations!')).toBeNull();
  });

  it('calls declineHomeInvite when decline confirmation is accepted', async () => {
    const user = userEvent.setup();
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    await user.press(await findByText('Decline'));

    // Get the alertService.alert call and execute the "Decline" button's onPress
    const alertCall = (alertService.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as AlertButton[];
    const declineButton = buttons.find(b => b.text === 'Decline');
    declineButton?.onPress?.();

    await waitFor(() => {
      expect(recordedMutations).toContainEqual({
        name: 'DeclineHomeInvite',
        variables: { input: { token: 'invite-1' } },
      });
    });
  });

  it('requests a join code when the email is verified', async () => {
    const user = userEvent.setup();

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    await waitFor(() => {
      expect(recordedMutations).toContainEqual(
        expect.objectContaining({
          name: 'CreateHome',
          variables: expect.objectContaining({
            input: expect.objectContaining({ allowJoinCode: true }),
          }),
        }),
      );
    });
  });

  it('creates the home without a join code when the email is unverified', async () => {
    // The server refuses createHome outright for allowJoinCode: true from an
    // unverified caller — asking for one here would dead-end onboarding for
    // anyone who deferred verification.
    const user = userEvent.setup();
    mockHasUnverifiedEmail = true;

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    await waitFor(() => {
      expect(recordedMutations).toContainEqual(
        expect.objectContaining({
          name: 'CreateHome',
          variables: expect.objectContaining({
            input: expect.objectContaining({ allowJoinCode: false }),
          }),
        }),
      );
    });
  });

  it('shows error message when createHome mutation fails', async () => {
    const user = userEvent.setup();
    mockCreateHomeError = new Error('Network error');

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage).toBeTruthy();
  });

  it('sets home id and pantry id on successful createHome with home in response', async () => {
    const user = userEvent.setup();
    mockCreateHomeResponse = {
      createHome: {
        __typename: 'CreateHomePayload',
        home: {
          __typename: 'Home',
          id: 'home-new',
          name: 'My Home',
          isDefault: true,
          version: 1,
          pantriesConnection: {
            __typename: 'PantryConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'PantryEdge',
                node: { __typename: 'Pantry', id: 'p1', isDefault: true },
              },
            ],
          },
          myMembership: null,
        },
      },
    };

    const { extractNodes } = require('#/utils/connectionUtils');
    // First call is during initial render (homesData?.homes), second is during mutation result
    extractNodes
      .mockReturnValueOnce([]) // initial render: no homes
      .mockReturnValueOnce([{ id: 'p1', isDefault: true }]); // mutation result: pantries

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    await waitFor(() => {
      expect(mockSetSelectedHomeId).toHaveBeenCalledWith('home-new');
    });
    expect(mockSetSelectedPantryId).toHaveBeenCalledWith('p1');
  });

  it('handles createHome conflict error response', async () => {
    const user = userEvent.setup();
    mockCreateHomeResponse = {
      createHome: {
        __typename: 'ConflictError',
        code: 'CONFLICT',
        message: 'A home with this name already exists',
      },
    };

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    const { executeWithLoadingState } = require('#/utils/finallyHelpers');
    await waitFor(() => {
      expect(executeWithLoadingState).toHaveBeenCalled();
    });
  });

  it('shows error when createHome returns error payload', async () => {
    const user = userEvent.setup();
    mockCreateHomeResponse = {
      createHome: {
        __typename: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Home limit reached',
        field: null,
      },
    };

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    await waitFor(async () => {
      expect(await findByTestId('error-message')).toBeTruthy();
    });
  });

  it('shows the code’s own copy when the refusal carries no message', async () => {
    const user = userEvent.setup();
    mockCreateHomeResponse = {
      createHome: {
        __typename: 'ForbiddenError',
        code: 'FORBIDDEN',
        message: '',
      },
    };

    const { findByTestId, findByText } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    // Never the refusal's `message` — that text is English by construction, and
    // it used to be rendered verbatim. The CODE is what selects the copy, so an
    // empty message changes nothing while a code is present.
    //
    // This asserted the generic fallback until the test cache started loading
    // the production `possibleTypes`. Without them `... on Error { code }` did
    // not match, `code` was dropped, `unwrapPayload` substituted `'UNKNOWN'`,
    // and the screen fell back — so the assertion described the mock rather
    // than the app.
    expect(
      await findByText("You don't have permission to perform this action"),
    ).toBeTruthy();
  });

  it('falls back to this screen’s copy when the code has none', async () => {
    const user = userEvent.setup();
    mockCreateHomeResponse = {
      createHome: {
        __typename: 'ForbiddenError',
        code: 'NOT_A_MAPPED_CODE',
        message: '',
      },
    };

    const { findByTestId, findByText } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    // The path the test above was NAMED for and never reached: the caller's
    // fallback is used only when the code resolves to no copy of its own.
    expect(await findByText('An error occurred during setup')).toBeTruthy();
  });

  it('handles pantry creation when home exists but pantry does not', async () => {
    const user = userEvent.setup();
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [],
          totalCount: 0,
        },
      },
    ]);

    const storeModule = require('#store/useAppStore');
    storeModule.useAppStore.mockImplementation(
      <T,>(selector: (state: RootState) => T): T =>
        selector(mockBuildState({ selectedHomeId: 'home-1' })),
    );
    storeModule.useUser.mockReturnValue(mockUser);
    storeModule.useSelectedHomeId.mockReturnValue('home-1');

    const { createPantryForHome } = require('../helpers');
    createPantryForHome.mockResolvedValue(true);

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    await waitFor(() => {
      expect(createPantryForHome).toHaveBeenCalled();
    });
  });

  it('shows pantry creation error and skips when pantry creation fails', async () => {
    const user = userEvent.setup();
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [],
          totalCount: 0,
        },
      },
    ]);

    const storeModule = require('#store/useAppStore');
    storeModule.useAppStore.mockImplementation(
      <T,>(selector: (state: RootState) => T): T =>
        selector(mockBuildState({ selectedHomeId: 'home-1' })),
    );
    storeModule.useUser.mockReturnValue(mockUser);
    storeModule.useSelectedHomeId.mockReturnValue('home-1');

    const {
      createPantryForHome,
      showPantryCreationError,
    } = require('../helpers');
    createPantryForHome.mockResolvedValue(false);

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    await waitFor(() => {
      expect(showPantryCreationError).toHaveBeenCalled();
    });
  });

  it('skips to CreateShoppingList when loading view skip is pressed', async () => {
    const user = userEvent.setup();
    const loadingMocks: MockedResponse[] = [
      {
        request: { query: GetHomesDocument, variables: () => true },
        maxUsageCount: 100,
        delay: Number.POSITIVE_INFINITY,
        result: { data: undefined },
      },
      buildGetMyPendingInvitesMock(),
    ];
    const { getByText } = renderWithApollo(<CreateHomeScreen />, {
      operationMocks: loadingMocks,
    });
    await user.press(getByText('Skip'));
    expect(mockSkipToStep).toHaveBeenCalledWith('CreateShoppingList');
  });

  it('skips to CreateShoppingList from create form onSkip', async () => {
    const { findByTestId } = renderScreen();
    // The OnBoardingWrapper has onSkip prop - verify the testID is used
    expect(await findByTestId('onboarding-create-home-screen')).toBeTruthy();
  });

  it('does not show error message when graphqlError is null', async () => {
    const { queryByTestId, findByText } = renderScreen();
    // Wait until the screen is settled
    await findByText("Welcome! Let's set up your home");
    expect(queryByTestId('error-message')).toBeNull();
  });

  it('shows role text from formatRole for invite', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'ADMIN',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('ADMIN')).toBeTruthy();
  });

  it('shows Pending Invitations section title on invite view', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Johns Home' },
        inviter: { email: 'john@test.com', profile: null },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('Pending Invitations')).toBeTruthy();
  });

  it('shows home and pantry names in existing setup view', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'Beach House',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [
            {
              __typename: 'PantryEdge',
              node: {
                __typename: 'Pantry',
                id: 'pantry-1',
                name: 'Main Pantry',
                isDefault: true,
              },
            },
          ],
          totalCount: 1,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(await findByText('Beach House')).toBeTruthy();
    expect(await findByText('Main Pantry')).toBeTruthy();
  });

  it('shows info text in existing setup view', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
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
          totalCount: 1,
        },
      },
    ]);

    const { findByText } = renderScreen();
    expect(await findByText(/already set up/)).toBeTruthy();
  });

  it('does not set pantry id when existing home has no pantries', async () => {
    stageHomes([
      {
        id: 'home-1',
        name: 'My Home',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [],
          totalCount: 0,
        },
      },
    ]);

    renderScreen();
    await waitFor(() => {
      expect(mockSetSelectedHomeId).toHaveBeenCalledWith('home-1');
    });
    // setSelectedPantryId should not be called since there are no pantries
    expect(mockSetSelectedPantryId).not.toHaveBeenCalled();
  });

  it('handles generic error on submit with no message', async () => {
    const user = userEvent.setup();
    // With Apollo errorPolicy: 'all', a network error resolves with
    // { data: undefined, error }, so the screen sees no payload and throws.
    // What it SHOWS is its own copy: a transport failure tells the caller only
    // that the request did not arrive, and the shared code copy for that
    // ("Showing cached data when available") is written for a read — on a
    // failed create it is not vague but untrue.
    mockCreateHomeError = new Error('');

    const { findByTestId, findByText } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    expect(await findByText('An error occurred during setup')).toBeTruthy();
  });

  it('shows multiple pending invites', async () => {
    mockPendingInvites = [
      {
        id: 'invite-1',
        token: 'invite-1',
        role: 'MEMBER',
        home: { name: 'Home A' },
        inviter: {
          email: 'a@test.com',
          profile: { displayName: 'Alice' },
        },
      },
      {
        id: 'invite-2',
        token: 'invite-2',
        role: 'ADMIN',
        home: { name: 'Home B' },
        inviter: { email: 'b@test.com', profile: { displayName: 'Bob' } },
      },
    ];

    const { findByText } = renderScreen();
    expect(await findByText('Home A')).toBeTruthy();
    expect(await findByText('Home B')).toBeTruthy();
    expect(await findByText('Alice')).toBeTruthy();
    expect(await findByText('Bob')).toBeTruthy();
  });

  it('navigates to next step on successful home creation with first pantry (non-default)', async () => {
    const user = userEvent.setup();
    const { extractNodes } = require('#/utils/connectionUtils');
    // First call is during initial render (homesData?.homes), second is during mutation result
    extractNodes
      .mockReturnValueOnce([]) // initial render: no homes
      .mockReturnValueOnce([{ id: 'p1', isDefault: false }]); // mutation result: pantries

    mockCreateHomeResponse = {
      createHome: {
        __typename: 'CreateHomePayload',
        home: {
          __typename: 'Home',
          id: 'home-new',
          name: 'My Home',
          isDefault: true,
          version: 1,
          pantriesConnection: {
            __typename: 'PantryConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'PantryEdge',
                node: { __typename: 'Pantry', id: 'p1', isDefault: false },
              },
            ],
          },
          myMembership: null,
        },
      },
    };

    const { findByTestId } = renderScreen();
    await user.press(await findByTestId('submit-button'));

    await waitFor(() => {
      expect(mockSetSelectedPantryId).toHaveBeenCalledWith('p1');
    });
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('CreateHome');
  });
});
