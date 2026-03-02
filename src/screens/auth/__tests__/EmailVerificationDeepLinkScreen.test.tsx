import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { EmailVerificationDeepLinkScreen } from '../EmailVerificationDeepLinkScreen';

// --- Mocks ---

const mockGoBack = jest.fn();
const mockVerifyEmail = jest.fn().mockResolvedValue({
  data: { verifyEmail: { success: true, message: '' } },
});
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

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@example.com', onBoarded: true },
    updateUser: mockUpdateUser,
  }),
}));

jest.mock('#generated', () => ({
  useVerifyEmailMutation: () => [mockVerifyEmail],
}));

jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutationWithErrorHandler: jest.fn(
    async (fn: () => Promise<any>, onError: any) => {
      try {
        await fn();
      } catch (error) {
        onError(error);
      }
    },
  ),
}));

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
    SousChefLoader: ({ message }: any) => <Text testID="loader">{message}</Text>,
  };
});

describe('EmailVerificationDeepLinkScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the verification screen', () => {
    render(<EmailVerificationDeepLinkScreen />);
    // The screen should render at least the header
    expect(screen.getByTestId('header')).toBeTruthy();
  });

  it('shows a loading state initially', () => {
    render(<EmailVerificationDeepLinkScreen />);
    expect(screen.getByTestId('loader')).toBeTruthy();
    expect(screen.getByText('Verifying your email...')).toBeTruthy();
  });

  it('calls verifyEmail on mount', async () => {
    render(<EmailVerificationDeepLinkScreen />);
    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith({
        variables: { code: 'abc123def456' },
      });
    });
  });

  it('calls goBack when header close button is pressed', () => {
    render(<EmailVerificationDeepLinkScreen />);
    fireEvent.press(screen.getByTestId('header-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows success state after successful verification', async () => {
    render(<EmailVerificationDeepLinkScreen />);
    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });
  });

  it('updates user after successful verification', async () => {
    render(<EmailVerificationDeepLinkScreen />);
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
    render(<EmailVerificationDeepLinkScreen />);
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeTruthy();
    });
  });

  it('shows Try Again button when token is missing', async () => {
    render(<EmailVerificationDeepLinkScreen />);
    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeTruthy();
    });
  });
});
