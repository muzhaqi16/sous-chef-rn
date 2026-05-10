import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  VerifyEmailDocument,
  ResendVerificationEmailDocument,
} from '#operations/auth/auth.generated';
import { CodeVerificationScreen } from '../CodeVerificationScreen';

// --- Mocks ---

const mockUpdateUser = jest.fn();
const mockToast = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: any) => {
    const state = {
      user: { id: '1', email: 'test@example.com', emailVerified: false },
      updateUser: mockUpdateUser,
    };
    return selector(state);
  },
}));

jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
  },
}));

jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/templates/AuthWrapper', () => {
  const { View } = require('react-native');
  return {
    AuthWrapper: ({ children }: any) => (
      <View testID="auth-wrapper">{children}</View>
    ),
  };
});

jest.mock('#components/templates/AuthFormTemplate', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    AuthFormTemplate: ({
      title,
      subtitle,
      submitText,
      onSubmit,
      footerText,
      footerLinkText,
      onFooterLinkPress,
      footerLinkDisabled,
      footerLinkCountdown,
    }: any) => (
      <View testID="auth-form-template">
        <Text>{title}</Text>
        {typeof subtitle === 'string' ? (
          <Text>{subtitle}</Text>
        ) : (
          <View testID="subtitle-container">{subtitle}</View>
        )}
        <Pressable testID="submit-button" onPress={onSubmit}>
          <Text>{submitText}</Text>
        </Pressable>
        {footerText ? <Text>{footerText}</Text> : null}
        {footerLinkText ? (
          <Pressable
            testID="footer-link"
            onPress={onFooterLinkPress}
            disabled={footerLinkDisabled}
          >
            <Text>{footerLinkText}</Text>
            {footerLinkCountdown > 0 ? (
              <Text testID="countdown">{footerLinkCountdown}</Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

jest.mock('#components/molecules/CodeInputAdapter', () => ({
  CodeInputAdapter: 'CodeInputAdapter',
}));

jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: 'SousChefLoader',
}));

function buildResendMock(
  recordedVariables: Record<string, unknown>[],
): MockedResponse {
  return {
    request: {
      query: ResendVerificationEmailDocument,
      variables: variables => {
        recordedVariables.push(variables);
        return true;
      },
    },
    result: {
      data: {
        resendVerificationEmail: {
          __typename: 'UserPayload',
          success: true,
          message: 'OK',
          code: 'OK',
        },
      },
    },
  };
}

// Verify mock kept available for potential extension; use a generic accept-all mock
function buildVerifyMock(): MockedResponse {
  return {
    request: { query: VerifyEmailDocument, variables: () => true },
    result: {
      data: {
        verifyEmail: {
          __typename: 'UserPayload',
          success: true,
          message: 'OK',
          code: 'OK',
          user: null,
        },
      },
    },
  };
}

describe('CodeVerificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the enter code title', () => {
    renderWithApollo(<CodeVerificationScreen />);
    expect(screen.getByText('Enter Code')).toBeTruthy();
  });

  it('renders the user email in the subtitle', () => {
    renderWithApollo(<CodeVerificationScreen />);
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders the submit button', () => {
    renderWithApollo(<CodeVerificationScreen />);
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('renders the resend code footer', () => {
    renderWithApollo(<CodeVerificationScreen />);
    expect(screen.getByText("Didn't get the email?")).toBeTruthy();
    expect(screen.getByText('Resend code')).toBeTruthy();
  });

  it('fires resend when footer link is pressed', async () => {
    const recordedVariables: Record<string, unknown>[] = [];
    renderWithApollo(<CodeVerificationScreen />, {
      operationMocks: [buildResendMock(recordedVariables), buildVerifyMock()],
    });
    fireEvent.press(screen.getByTestId('footer-link'));
    await waitFor(() => {
      expect(recordedVariables).toContainEqual({ email: 'test@example.com' });
    });
  });

  it('returns null when user is already verified', () => {
    jest
      .spyOn(require('#store/useAppStore'), 'useAppStore')
      .mockImplementation((selector: any) => {
        const state = {
          user: { id: '1', email: 'test@example.com', emailVerified: true },
          updateUser: mockUpdateUser,
        };
        return selector(state);
      });

    const { toJSON } = renderWithApollo(<CodeVerificationScreen />);
    expect(toJSON()).toBeNull();
  });

  it('returns null when there is no user', () => {
    jest
      .spyOn(require('#store/useAppStore'), 'useAppStore')
      .mockImplementation((selector: any) => {
        const state = {
          user: null,
          updateUser: mockUpdateUser,
        };
        return selector(state);
      });

    const { toJSON } = renderWithApollo(<CodeVerificationScreen />);
    expect(toJSON()).toBeNull();
  });
});
