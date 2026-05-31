'use no memo';

import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { CreateHomeScreen } from '../createHome/CreateHomeScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
const mockSkipToStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    setUserNavigationState: jest.fn(),
    skipToStep: mockSkipToStep,
  }),
}));

jest.mock('#store/useAppStore', () => {
  const mockState = {
    user: { id: 'u1', email: 'test@test.com' },
    selectedHomeId: null,
    setSelectedHomeId: jest.fn(),
    setSelectedPantryId: jest.fn(),
  };
  const fn = (selector: (state: typeof mockState) => unknown) =>
    selector(mockState);
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useUser: jest.fn(() => mockState.user),
    useSelectedHomeId: jest.fn(() => mockState.selectedHomeId),
    useSetSelectedPantryId: jest.fn(() => mockState.setSelectedPantryId),
  };
});

jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/utils/validation/onboarding', () => ({
  getCreateHomeSchema: jest.fn(() => ({
    fields: {},
    validate: jest.fn(),
    isValid: jest.fn(() => Promise.resolve(true)),
  })),
}));
jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(
    (c?: { edges?: { node: unknown }[] | null } | null) =>
      c?.edges?.map(e => e.node) || [],
  ),
}));
jest.mock('#/utils/compilerSafeWrappers');
jest.mock('#utils/formatters/roleFormatters', () => ({
  formatRole: jest.fn(r => r),
}));
jest.mock('../createHome/helpers', () => ({
  createPantryForHome: jest.fn(),
  showPantryCreationError: jest.fn(),
}));

jest.mock('#/components/providers/ScreenErrorBoundary', () => ({
  OnboardingErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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
jest.mock('../createHome/FormContent', () => ({
  FormContent: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="form-content">
        <Text>Form Content</Text>
      </View>
    );
  },
}));
jest.mock('../createHome/LoadingView', () => ({
  LoadingView: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="loading-view">
        <Text>Loading...</Text>
      </View>
    );
  },
}));
jest.mock('../createHome/SubmitButton', () => ({
  SubmitButton: ({ isCreating }: { isCreating: boolean }) => {
    const { Text } = require('react-native');
    return <Text>{isCreating ? 'Creating...' : 'Create'}</Text>;
  },
}));
jest.mock('../createHome/ErrorMessage', () => ({
  ErrorMessage: ({ message }: { message: string }) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress }: { title?: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

// Schema-driven mocks return empty homes/invites so the screen exits its
// loading state and shows the create form (no existing home, no invites).
const noHomesAndNoInvites = {
  Query: () => ({
    homes: {
      totalCount: 0,
      edges: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    me: { id: 'u1', pendingHomeInvites: [] },
  }),
};

describe('CreateHomeScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the create home form', async () => {
    renderWithApollo(<CreateHomeScreen />, { mocks: noHomesAndNoInvites });
    expect(await screen.findByText(/set up your home/i)).toBeTruthy();
  });

  it('shows form content for creating home', async () => {
    renderWithApollo(<CreateHomeScreen />, { mocks: noHomesAndNoInvites });
    expect(await screen.findByTestId('form-content')).toBeTruthy();
  });

  it('shows the submit button', async () => {
    renderWithApollo(<CreateHomeScreen />, { mocks: noHomesAndNoInvites });
    expect(await screen.findByText('Create')).toBeTruthy();
  });

  it('shows subtitle text', async () => {
    renderWithApollo(<CreateHomeScreen />, { mocks: noHomesAndNoInvites });
    expect(
      await screen.findByText('Create your home and pantry to get started'),
    ).toBeTruthy();
  });

  it('wraps in error boundary', async () => {
    // This test verifies it renders without crashing (boundary is mocked)
    renderWithApollo(<CreateHomeScreen />, { mocks: noHomesAndNoInvites });
    expect(
      await screen.findByTestId('onboarding-create-home-screen'),
    ).toBeTruthy();
  });
});
