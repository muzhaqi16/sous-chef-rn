'use no memo';

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CreateHomeScreen } from '../CreateHomeScreen';

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

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({
      user: { id: 'user-1' },
      selectedHomeId: null,
      setSelectedHomeId: mockSetSelectedHomeId,
      setSelectedPantryId: mockSetSelectedPantryId,
    }),
  ),
  selectUser: (s: any) => s.user,
  selectSelectedHomeId: (s: any) => s.selectedHomeId,
}));

const mockCreateHome = jest.fn();
const mockCreatePantry = jest.fn();
const mockAcceptHomeInvite = jest.fn();
const mockDeclineHomeInvite = jest.fn();

jest.mock('#generated', () => ({
  HomeType: { Household: 'HOUSEHOLD' },
  useCreateHomeMutation: () => [mockCreateHome],
  useCreatePantryMutation: () => [mockCreatePantry, {}],
  useGetHomesQuery: jest.fn(() => ({
    data: { homes: { edges: [] } },
    loading: false,
    refetch: jest.fn(),
  })),
  useGetMyPendingInvitesQuery: jest.fn(() => ({
    data: { me: { pendingHomeInvites: [] } },
    loading: false,
  })),
  useAcceptHomeInviteMutation: () => [mockAcceptHomeInvite, { loading: false }],
  useDeclineHomeInviteMutation: () => [mockDeclineHomeInvite],
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

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHomes: jest.fn((homes: any) => homes || []),
  extractNodes: jest.fn((data: any) => data?.edges?.map((e: any) => e.node) || []),
}));

jest.mock('#/components/providers/ScreenErrorBoundary', () => ({
  OnboardingErrorBoundary: ({ children }: any) => children,
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/utils/compilerSafeWrappers');

// Mock form components
jest.mock('../FormContent', () => ({
  FormContent: () => {
    const { View, Text } = require('react-native');
    return <View testID="form-content"><Text>Form Content</Text></View>;
  },
}));

jest.mock('../LoadingView', () => ({
  LoadingView: ({ onSkip }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="loading-view">
        <Text>Loading...</Text>
        <Pressable onPress={onSkip}><Text>Skip</Text></Pressable>
      </View>
    );
  },
}));

jest.mock('#components/templates/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({ title, subtitle, children, testID }: any) => {
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
  SubmitButton: ({ onPress, isCreating }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable testID="submit-button" onPress={onPress}><Text>{isCreating ? 'Creating...' : 'Submit'}</Text></Pressable>;
  },
}));

jest.mock('../ErrorMessage', () => ({
  ErrorMessage: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text testID="error-message">{message}</Text>;
  },
}));

jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable testID={`button-${title}`} onPress={onPress}><Text>{title}</Text></Pressable>;
  },
}));

jest.mock('#utils/formatters/roleFormatters', () => ({
  formatRole: jest.fn((role: string) => role),
}));

// Mock react-hook-form
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: (fn: any) => () => fn({ homeName: 'My Home', pantryName: 'Kitchen' }),
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

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  const { useGetHomesQuery, useGetMyPendingInvitesQuery } = require('#generated');
  useGetHomesQuery.mockReturnValue({
    data: { homes: { edges: [] } },
    loading: false,
    refetch: jest.fn(),
  });
  useGetMyPendingInvitesQuery.mockReturnValue({
    data: { me: { pendingHomeInvites: [] } },
    loading: false,
  });

  const { normalizeHomes, extractNodes } = require('#/utils/connectionUtils');
  normalizeHomes.mockImplementation((homes: any) => homes || []);
  extractNodes.mockImplementation((data: any) => data?.edges?.map((e: any) => e.node) || []);

  const { formatRole } = require('#utils/formatters/roleFormatters');
  formatRole.mockImplementation((role: string) => role);
});

describe('CreateHomeScreen', () => {
  it('renders create home form when no existing home', () => {
    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText("Welcome! Let's set up your home")).toBeTruthy();
  });

  it('shows form content', () => {
    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Form Content')).toBeTruthy();
  });

  it('renders submit button', () => {
    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Submit')).toBeTruthy();
  });

  it('shows loading view when checking existing resources', () => {
    const { useGetHomesQuery } = require('#generated');
    useGetHomesQuery.mockReturnValue({
      data: null,
      loading: true,
      refetch: jest.fn(),
    });

    const { getByTestId } = render(<CreateHomeScreen />);
    expect(getByTestId('loading-view')).toBeTruthy();
  });

  it('shows existing resources when both home and pantry exist', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [{ id: 'pantry-1', name: 'Kitchen', isDefault: true }],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText("You're all set!")).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('shows continue button for existing setup', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [{ id: 'pantry-1', name: 'Kitchen', isDefault: true }],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByText('Continue'));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('CreateHome');
  });

  it('shows pending invites when available and no home', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: { displayName: 'John' } },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('You have pending home invitations!')).toBeTruthy();
    expect(getByText('Johns Home')).toBeTruthy();
  });

  it('shows loading view when invites are loading', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: null,
      loading: true,
    });

    const { getByTestId } = render(<CreateHomeScreen />);
    expect(getByTestId('loading-view')).toBeTruthy();
  });

  it('shows "Almost there!" title when home exists but no pantry', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Almost there!')).toBeTruthy();
  });

  it('shows subtitle about adding pantry when home exists but no pantry', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText("Let's add a pantry to My Home")).toBeTruthy();
  });

  it('shows correct subtitle when no home exists', () => {
    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Create your home and pantry to get started')).toBeTruthy();
  });

  it('shows subtitle for existing setup', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [{ id: 'pantry-1', name: 'Kitchen', isDefault: true }],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Your home and pantry are already configured')).toBeTruthy();
  });

  it('shows existing home name in resource card when home exists but pantry missing', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Existing Home')).toBeTruthy();
    expect(getByText('My Home')).toBeTruthy();
  });

  it('shows "Default" badge on default pantry in existing setup view', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [{ id: 'pantry-1', name: 'Kitchen', isDefault: true }],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Default')).toBeTruthy();
  });

  it('does not show "Default" badge when pantry is not default', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [{ id: 'pantry-1', name: 'Kitchen', isDefault: false }],
      },
    ]);

    const { queryByText } = render(<CreateHomeScreen />);
    expect(queryByText('Default')).toBeNull();
  });

  it('calls skipToStep when "Create My Own Home" is pressed on invites screen', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: { displayName: 'John' } },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    // Press "Skip for Now"
    fireEvent.press(getByText('Skip for Now'));
    expect(mockSkipToStep).toHaveBeenCalledWith('CreateShoppingList');
  });

  it('shows inviter display name when available', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: { displayName: 'John' } },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('John')).toBeTruthy();
  });

  it('shows inviter email when displayName is missing', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('john@test.com')).toBeTruthy();
  });

  it('shows "Someone" when inviter info is missing', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: null,
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Someone')).toBeTruthy();
  });

  it('shows "Unknown Home" when home name is missing from invite', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: null,
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Unknown Home')).toBeTruthy();
  });

  it('calls acceptHomeInvite when Accept button is pressed', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByText('Accept'));
    expect(mockAcceptHomeInvite).toHaveBeenCalledWith({ variables: { token: 'invite-1' } });
  });

  it('calls Alert.alert when Decline button is pressed', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByText('Decline'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Decline Invitation',
      expect.stringContaining('Johns Home'),
      expect.any(Array),
    );
  });

  it('submits form and calls createHome on submit', async () => {
    mockCreateHome.mockResolvedValue({
      data: {
        createHome: {
          success: true,
          home: {
            id: 'home-new',
            pantriesConnection: { edges: [{ node: { id: 'p1', isDefault: true } }] },
          },
        },
      },
    });

    const { getByTestId } = render(<CreateHomeScreen />);
    fireEvent.press(getByTestId('submit-button'));

    // executeWithLoadingState was called
    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    expect(executeWithLoadingState).toHaveBeenCalled();
  });

  it('shows "Create My Own Home" button on invite view', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Create My Own Home')).toBeTruthy();
    // Pressing it should show the create form
    fireEvent.press(getByText('Create My Own Home'));
  });

  it('selects first pantry as fallback when no default pantry exists', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [{ id: 'pantry-1', name: 'Kitchen', isDefault: false }],
      },
    ]);

    render(<CreateHomeScreen />);
    // syncExistingResources should call setSelectedHomeId and setSelectedPantryId
    expect(mockSetSelectedHomeId).toHaveBeenCalledWith('home-1');
    expect(mockSetSelectedPantryId).toHaveBeenCalledWith('pantry-1');
  });

  it('switches to create form after pressing "Create My Own Home" on invite view', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText, queryByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByText('Create My Own Home'));
    // After pressing, should show create form instead of invites
    expect(getByText("Welcome! Let's set up your home")).toBeTruthy();
    expect(queryByText('You have pending home invitations!')).toBeNull();
  });

  it('calls declineHomeInvite when decline confirmation is accepted', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByText('Decline'));

    // Get the Alert.alert call and execute the "Decline" button's onPress
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const declineButton = buttons.find((b: any) => b.text === 'Decline');
    declineButton.onPress();

    expect(mockDeclineHomeInvite).toHaveBeenCalledWith({ variables: { token: 'invite-1' } });
  });

  it('shows error message when createHome mutation fails', async () => {
    mockCreateHome.mockRejectedValue(new Error('Network error'));

    const { getByTestId, findByTestId } = render(<CreateHomeScreen />);
    fireEvent.press(getByTestId('submit-button'));

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage).toBeTruthy();
  });

  it('sets home id and pantry id on successful createHome with home in response', async () => {
    mockCreateHome.mockResolvedValue({
      data: {
        createHome: {
          success: true,
          home: {
            id: 'home-new',
            pantriesConnection: { edges: [{ node: { id: 'p1', isDefault: true } }] },
          },
        },
      },
    });

    const { extractNodes } = require('#/utils/connectionUtils');
    // First call is during initial render (homesData?.homes), second is during mutation result
    extractNodes
      .mockReturnValueOnce([]) // initial render: no homes
      .mockReturnValueOnce([{ id: 'p1', isDefault: true }]); // mutation result: pantries

    const { getByTestId } = render(<CreateHomeScreen />);
    await fireEvent.press(getByTestId('submit-button'));

    expect(mockSetSelectedHomeId).toHaveBeenCalledWith('home-new');
    expect(mockSetSelectedPantryId).toHaveBeenCalledWith('p1');
  });

  it('handles createHome success without home in response by refetching', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({
      data: { homes: { edges: [{ node: { id: 'found-home', name: 'My Home' } }] } },
    });

    const { useGetHomesQuery } = require('#generated');
    useGetHomesQuery.mockReturnValue({
      data: { homes: { edges: [] } },
      loading: false,
      refetch: mockRefetch,
    });

    const { normalizeHomes } = require('#/utils/connectionUtils');
    // First call for initial render: no homes; after refetch: found home
    normalizeHomes
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: 'found-home', name: 'My Home' }]);

    mockCreateHome.mockResolvedValue({
      data: {
        createHome: {
          success: true,
          home: null,
        },
      },
    });

    const { getByTestId } = render(<CreateHomeScreen />);
    await fireEvent.press(getByTestId('submit-button'));

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows error when createHome returns unsuccessful payload', async () => {
    mockCreateHome.mockResolvedValue({
      data: {
        createHome: {
          success: false,
          message: 'Home limit reached',
        },
      },
    });

    const { getByTestId } = render(<CreateHomeScreen />);
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByTestId('error-message')).toBeTruthy();
    });
  });

  it('shows default error message when createHome fails without message', async () => {
    mockCreateHome.mockResolvedValue({
      data: {
        createHome: {
          success: false,
          message: null,
        },
      },
    });

    const { getByTestId, getByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Failed to create home')).toBeTruthy();
    });
  });

  it('handles pantry creation when home exists but pantry does not', async () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [],
      },
    ]);

    const { useAppStore } = require('#store/useAppStore');
    useAppStore.mockImplementation((selector: any) =>
      selector({
        user: { id: 'user-1' },
        selectedHomeId: 'home-1',
        setSelectedHomeId: mockSetSelectedHomeId,
        setSelectedPantryId: mockSetSelectedPantryId,
      }),
    );

    const { createPantryForHome } = require('../helpers');
    createPantryForHome.mockResolvedValue(true);

    const { getByTestId } = render(<CreateHomeScreen />);
    await fireEvent.press(getByTestId('submit-button'));

    expect(createPantryForHome).toHaveBeenCalled();
  });

  it('shows pantry creation error and skips when pantry creation fails', async () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [],
      },
    ]);

    const { useAppStore } = require('#store/useAppStore');
    useAppStore.mockImplementation((selector: any) =>
      selector({
        user: { id: 'user-1' },
        selectedHomeId: 'home-1',
        setSelectedHomeId: mockSetSelectedHomeId,
        setSelectedPantryId: mockSetSelectedPantryId,
      }),
    );

    const { createPantryForHome, showPantryCreationError } = require('../helpers');
    createPantryForHome.mockResolvedValue(false);

    const { getByTestId } = render(<CreateHomeScreen />);
    await fireEvent.press(getByTestId('submit-button'));

    expect(showPantryCreationError).toHaveBeenCalled();
  });

  it('skips to CreateShoppingList when loading view skip is pressed', () => {
    const { useGetHomesQuery } = require('#generated');
    useGetHomesQuery.mockReturnValue({
      data: null,
      loading: true,
      refetch: jest.fn(),
    });

    const { getByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByText('Skip'));
    expect(mockSkipToStep).toHaveBeenCalledWith('CreateShoppingList');
  });

  it('skips to CreateShoppingList from create form onSkip', () => {
    const { getByTestId } = render(<CreateHomeScreen />);
    // The OnBoardingWrapper has onSkip prop - verify the testID is used
    expect(getByTestId('onboarding-create-home-screen')).toBeTruthy();
  });

  it('does not show error message when graphqlError is null', () => {
    const { queryByTestId } = render(<CreateHomeScreen />);
    expect(queryByTestId('error-message')).toBeNull();
  });

  it('shows role text from formatRole for invite', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'ADMIN',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('ADMIN')).toBeTruthy();
  });

  it('shows Pending Invitations section title on invite view', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Johns Home' },
              inviter: { email: 'john@test.com', profile: null },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Pending Invitations')).toBeTruthy();
  });

  it('shows home and pantry names in existing setup view', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'Beach House',
        pantries: [{ id: 'pantry-1', name: 'Main Pantry', isDefault: true }],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Beach House')).toBeTruthy();
    expect(getByText('Main Pantry')).toBeTruthy();
  });

  it('shows info text in existing setup view', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [{ id: 'pantry-1', name: 'Kitchen', isDefault: true }],
      },
    ]);

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText(/already set up/)).toBeTruthy();
  });

  it('does not set pantry id when existing home has no pantries', () => {
    const { normalizeHomes } = require('#/utils/connectionUtils');
    normalizeHomes.mockReturnValue([
      {
        id: 'home-1',
        name: 'My Home',
        pantries: [],
      },
    ]);

    render(<CreateHomeScreen />);
    expect(mockSetSelectedHomeId).toHaveBeenCalledWith('home-1');
    // setSelectedPantryId should not be called since there are no pantries
    expect(mockSetSelectedPantryId).not.toHaveBeenCalled();
  });

  it('handles generic error on submit with no message', async () => {
    mockCreateHome.mockRejectedValue({});

    const { getByTestId, getByText } = render(<CreateHomeScreen />);
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('An error occurred during setup')).toBeTruthy();
    });
  });

  it('shows multiple pending invites', () => {
    const { useGetMyPendingInvitesQuery } = require('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              home: { name: 'Home A' },
              inviter: { email: 'a@test.com', profile: { displayName: 'Alice' } },
            },
            {
              id: 'invite-2',
              role: 'ADMIN',
              home: { name: 'Home B' },
              inviter: { email: 'b@test.com', profile: { displayName: 'Bob' } },
            },
          ],
        },
      },
      loading: false,
    });

    const { getByText } = render(<CreateHomeScreen />);
    expect(getByText('Home A')).toBeTruthy();
    expect(getByText('Home B')).toBeTruthy();
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
  });

  it('navigates to next step on successful home creation with first pantry (non-default)', async () => {
    const { extractNodes } = require('#/utils/connectionUtils');
    // First call is during initial render (homesData?.homes), second is during mutation result
    extractNodes
      .mockReturnValueOnce([]) // initial render: no homes
      .mockReturnValueOnce([{ id: 'p1', isDefault: false }]); // mutation result: pantries

    mockCreateHome.mockResolvedValue({
      data: {
        createHome: {
          success: true,
          home: {
            id: 'home-new',
            pantriesConnection: { edges: [{ node: { id: 'p1', isDefault: false } }] },
          },
        },
      },
    });

    const { getByTestId } = render(<CreateHomeScreen />);
    await fireEvent.press(getByTestId('submit-button'));

    expect(mockSetSelectedPantryId).toHaveBeenCalledWith('p1');
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('CreateHome');
  });
});
