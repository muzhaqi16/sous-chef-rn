import React from 'react';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { VerifyEmailDocument } from '#operations/auth/auth.generated';
import { UserRole, AppTheme, ErrorCode } from '#/graphql/generated/schemaTypes';
import type { RootState } from '#store/index';
import { EmailVerificationDeepLinkScreen } from '../EmailVerificationDeepLinkScreen';

// --- Mocks ---

const mockGoBack = jest.fn();
const mockUpdateUser = jest.fn();
const mockToast = jest.fn();
const mockNavigateToLogin = jest.fn();
const mockReplaceWithLogin = jest.fn();

jest.mock('#hooks/navigation/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToLogin: mockNavigateToLogin,
    replaceWithLogin: mockReplaceWithLogin,
  }),
}));

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: mockGoBack }),
}));

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
  const getState = () =>
    ({ updateUser: mockUpdateUser } as Partial<RootState> as RootState);
  return {
    useAppStore: <T,>(selector: (state: RootState) => T): T =>
      selector(getState()),
    useUser: jest.fn(() => mockUserObject),
    useUpdateUser: () => getState().updateUser,
  };
});

jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

// Environment is auto-mocked via jest.setup.js; logger methods are no-op jest.fn().

jest.mock('#/utils/finallyHelpers');

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/molecules/Header', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    Header: ({ onClose }: { onClose?: () => void }) => (
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

jest.mock('#components/atoms/SousChefLoader', () => {
  const { Text } = require('react-native');
  return {
    SousChefLoader: ({ message }: { message?: string }) => (
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
            role: UserRole.User,
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
              theme: AppTheme.Light,
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

  it('spends the token exactly once even as the stored user changes identity', async () => {
    // The regression: verifying writes `emailVerified` back to the store, which
    // republished the user object, which re-ran the effect, which spent another
    // of the 10 hourly `verifyEmail` requests — the screen looped on
    // "Verifying…" until the API rate-limited it.
    const { useUser } = require('#store/useAppStore');
    (useUser as jest.Mock).mockImplementation(() => ({ ...mockUserObject }));

    const recordedVariables: Record<string, unknown>[] = [];
    const { rerender } = renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock(recordedVariables)],
    });

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });

    rerender(<EmailVerificationDeepLinkScreen />);
    rerender(<EmailVerificationDeepLinkScreen />);

    expect(recordedVariables).toHaveLength(1);
    // Still settled on the success state, not knocked back to "Verifying…".
    expect(screen.getByText('Email Verified!')).toBeTruthy();
  });

  it('treats an already-verified address as success', async () => {
    // A link opened twice — mail app, then browser — is a verified account, not
    // a failure worth showing the user.
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [
        {
          request: { query: VerifyEmailDocument, variables: () => true },
          result: {
            data: {
              verifyEmail: {
                __typename: 'ConflictError',
                code: ErrorCode.EmailAlreadyVerified,
                message: 'Email already verified',
              },
            },
          },
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ emailVerified: true });
  });

  it('steps aside once a signed-in user is verified', async () => {
    // The root navigator re-derives its target from `emailVerified`, but this
    // screen lives in the always-mounted deep-link group and would otherwise
    // stay on top of the destination it just unlocked.
    jest.useFakeTimers();
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });
    // Signed in, so the next step is the app — not the sign-in hand-off.
    expect(screen.queryByTestId('email-verified-sign-in')).toBeNull();

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockNavigateToLogin).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('cancels the hand-off when the screen is closed first', async () => {
    jest.useFakeTimers();
    const { unmount } = renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });

    unmount();
    mockGoBack.mockClear();
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('EmailVerificationDeepLinkScreen - no session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const { useRoute } = require('@react-navigation/native');
    (useRoute as jest.Mock).mockReturnValue({
      params: { token: 'abc123def456' },
      key: 'test-key',
      name: 'EmailVerificationDeepLink',
    });
    const { useUser } = require('#store/useAppStore');
    (useUser as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hands off to sign-in, since verifying opens no session', async () => {
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [buildVerifyMock()],
    });

    await waitFor(() => {
      expect(screen.getByTestId('email-verified-sign-in')).toBeTruthy();
    });
    expect(
      screen.getByText(/Your account is active — sign in to get started\./),
    ).toBeTruthy();

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    // `replace`, not `navigate`: the deep-link group has no `if`, so a screen
    // merely navigated away from outlives the Auth group that signing in
    // removes and resurfaces as the top route right after login.
    expect(mockReplaceWithLogin).toHaveBeenCalled();
    expect(mockNavigateToLogin).not.toHaveBeenCalled();
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

describe('EmailVerificationDeepLinkScreen - retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useRoute } = require('@react-navigation/native');
    (useRoute as jest.Mock).mockReturnValue({
      params: { token: 'abc123def456' },
      key: 'test-key',
      name: 'EmailVerificationDeepLink',
    });
    const { useUser } = require('#store/useAppStore');
    (useUser as jest.Mock).mockReturnValue(mockUserObject);
  });

  it('keeps the failure on screen while retrying instead of blanking to the loader', async () => {
    // Reusing the initial-verification flag for a retry swaps the whole screen
    // back to "Verifying…" and takes away the failure the user is reading.
    // Progress belongs in the button alone.
    const failingMock: MockedResponse = {
      request: { query: VerifyEmailDocument, variables: () => true },
      result: {
        data: {
          verifyEmail: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'Verification code is invalid or expired',
            field: 'code',
          },
        },
      },
      maxUsageCount: 2,
      delay: 20,
    };

    const user = userEvent.setup();
    renderWithApollo(<EmailVerificationDeepLinkScreen />, {
      operationMocks: [failingMock],
    });

    await waitFor(() => {
      expect(screen.getByTestId('verification-retry')).toBeTruthy();
    });

    await user.press(screen.getByTestId('verification-retry'));

    // Still the failure state — no full-page loader, no lost error message.
    expect(screen.getByText('Verification Failed')).toBeTruthy();
    expect(
      screen.getByText('Verification code is invalid or expired'),
    ).toBeTruthy();
    expect(screen.queryByTestId('loader')).toBeNull();
  });
});
