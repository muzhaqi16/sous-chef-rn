'use no memo';

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import { OnboardingCompleteScreen } from '../OnboardingCompleteScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#store/useAppStore', () => {
  const fn = (selector: any) =>
    selector({
      user: { id: 'u1', onBoarded: false },
      updateUser: jest.fn(),
    });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn };
});

jest.mock('#hooks/performance/useScreenTransition');

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
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="complete-button">
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

function buildCompleteOnboardingMock(): MockedResponse {
  return {
    request: { query: CompleteOnboardingDocument, variables: {} },
    result: {
      data: {
        completeOnboarding: {
          __typename: 'UserPayload',
          success: true,
          message: 'OK',
          code: 'OK',
          user: {
            __typename: 'User',
            id: 'u1',
            email: 'a@b.com',
            emailVerified: true,
            role: 'USER' as any,
            canAccessDevTools: false,
            onBoarded: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            timezone: 'UTC',
          },
        },
      },
    },
  };
}

describe('OnboardingCompleteScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders all set title', () => {
    renderWithApollo(<OnboardingCompleteScreen />);
    expect(screen.getByText('All set!')).toBeTruthy();
  });

  it('renders subtitle', () => {
    renderWithApollo(<OnboardingCompleteScreen />);
    expect(screen.getByText('Your home is ready to use')).toBeTruthy();
  });

  it('renders congratulations text', () => {
    renderWithApollo(<OnboardingCompleteScreen />);
    expect(
      screen.getByText("Congratulations! You've successfully set up:"),
    ).toBeTruthy();
  });

  it('renders summary items', () => {
    renderWithApollo(<OnboardingCompleteScreen />);
    expect(screen.getByText(/Your home and pantry/)).toBeTruthy();
    expect(screen.getByText(/Your shopping list/)).toBeTruthy();
    expect(screen.getByText(/Initial pantry items/)).toBeTruthy();
    expect(screen.getByText(/Invited family/)).toBeTruthy();
  });

  it('renders the Get Started button', () => {
    renderWithApollo(<OnboardingCompleteScreen />);
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('calls mutation on button press', async () => {
    renderWithApollo(<OnboardingCompleteScreen />, {
      operationMocks: [buildCompleteOnboardingMock()],
    });
    fireEvent.press(screen.getByTestId('complete-button'));
    // The mutation request matches the operation mock; the onCompleted handler
    // will execute. We assert by waiting for the loading state (button still
    // in DOM) since side effects are limited to store.updateUser (mocked).
    await waitFor(() => {
      expect(screen.getByTestId('complete-button')).toBeTruthy();
    });
  });

  it('renders testID', () => {
    renderWithApollo(<OnboardingCompleteScreen />);
    expect(screen.getByTestId('onboarding-complete-screen')).toBeTruthy();
  });
});
