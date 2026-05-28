import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { VerifyEmailDocument } from '#operations/auth/auth.generated';
import { EmailVerificationDeepLinkScreen } from '../EmailVerificationDeepLinkScreen';

// --- Mocks ---

const mockGoBack = jest.fn();
const mockUpdateUser = jest.fn();
const mockToast = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: jest.fn(() => ({
    params: { token: 'abc123def456' },
    key: 'test-key',
    name: 'EmailVerificationDeepLink',
  })),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
  }),
}));

const mockUserObject = {
  id: '1',
  email: 'test@example.com',
  onBoarded: true,
};

jest.mock('#store/useAppStore', () => {
  const getState = () => ({
    updateUser: mockUpdateUser,
  });
  return {
    useAppStore: (selector: any) => selector(getState()),
    useUser: jest.fn(() => mockUserObject),
    useUpdateUser: () => (s => s.updateUser)(getState()),
  };
});

jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

// Environment is auto-mocked via jest.setup.js; logger methods are no-op jest.fn().

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/molecules/Header', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    Header: ({ onClose }: any) => (
      <View testID="header">
        {onClose ? (
          <Pressable testID="header-close" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

jest.mock('#/components/base/SousChefLoader', () => {
  const { Text } = require('react-native');
  return {
    SousChefLoader: ({ message }: any) => (
      <Text testID="loader">{message}</Text>
    ),
  };
});

function buildVerifyMock(
  recordedVariables: Record<string, unknown>[] = [],
): MockedResponse {
  return {
    request: {
      query: VerifyEmailDocument,
      variables: variables => {
        recordedVariables.push(variables);
        return true;
      },
    },
    result: {
      data: {
        verifyEmail: {
          __typename: 'VerifyEmailPayload',
          user: {
            __typename: 'User',
            id: '1',
            email: 'test@example.com',
            emailVerified: true,
            role: 'USER' as any,
            canAccessDevTools: false,
            onBoarded: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            timezone: 'UTC',
            defaultHomeId: null,
            defaultShoppingListId: null,
            defaultHome: null,
            profile: {
              __typename: 'UserProfile',
              id: 'p1',
              displayName: 'Test',
              avatar: null,
            },
            settings: {
              __typename: 'UserSettings',
              id: 's1',
              theme: 'LIGHT' as any,
            },
          },
        },
      },
    },
  };
}

describe('EmailVerificationDeepLinkScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the verification screen', () => {
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });
    // The screen should render at least the header
    expect(screen.getByTestId('header')).toBeTruthy();
  });

  it('shows a loading state initially', () => {
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });
    expect(screen.getByTestId('loader')).toBeTruthy();
    expect(screen.getByText('Verifying your email...')).toBeTruthy();
  });

  it('calls verifyEmail on mount', async () => {
    const recordedVariables: Record<string, unknown>[] = [];
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock(recordedVariables)],
    });
    await waitFor(() => {
      expect(recordedVariables).toContainEqual({
        input: { code: 'abc123def456' },
      });
    });
  });

  it('calls goBack when header close button is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });
    await user.press(screen.getByTestId('header-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows success state after successful verification', async () => {
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });
    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });
  });

  it('updates user after successful verification', async () => {
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true }),
      );
    });
  });
});

describe('EmailVerificationDeepLinkScreen - no token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useRoute } = require('@react-navigation/native');
    (useRoute as jest.Mock).mockReturnValue({
      params: {},
      key: 'test-key',
      name: 'EmailVerificationDeepLink',
    });
  });

  it('shows error state when token is missing', async () => {
    renderWithApollo(<EmailVerificationDeepLinkScreen />);
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeTruthy();
    });
  });

  it('shows Try Again button when token is missing', async () => {
    renderWithApollo(<EmailVerificationDeepLinkScreen />);
    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeTruthy();
    });
  });
});
