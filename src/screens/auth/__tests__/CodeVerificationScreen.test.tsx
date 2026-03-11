import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CodeVerificationScreen } from '../CodeVerificationScreen';

// --- Mocks ---

const mockVerifyEmail = jest.fn().mockResolvedValue({
  data: { verifyEmail: { success: true, message: '' } },
});
const mockResendVerificationEmail = jest.fn().mockResolvedValue({});
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

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useVerifyEmailMutation: () => [mockVerifyEmail],
  useResendVerificationEmailMutation: () => [mockResendVerificationEmail],
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
    AuthWrapper: ({ children }: any) => <View testID="auth-wrapper">{children}</View>,
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

describe('CodeVerificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the enter code title', () => {
    render(<CodeVerificationScreen />);
    expect(screen.getByText('Enter Code')).toBeTruthy();
  });

  it('renders the user email in the subtitle', () => {
    render(<CodeVerificationScreen />);
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders the submit button', () => {
    render(<CodeVerificationScreen />);
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('renders the resend code footer', () => {
    render(<CodeVerificationScreen />);
    expect(screen.getByText("Didn't get the email?")).toBeTruthy();
    expect(screen.getByText('Resend code')).toBeTruthy();
  });

  it('fires resend when footer link is pressed', () => {
    render(<CodeVerificationScreen />);
    fireEvent.press(screen.getByTestId('footer-link'));
    expect(mockResendVerificationEmail).toHaveBeenCalledWith({
      variables: { email: 'test@example.com' },
    });
  });

  it('returns null when user is already verified', () => {
    jest
      .spyOn(
        require('#store/useAppStore'),
        'useAppStore',
      )
      .mockImplementation((selector: any) => {
        const state = {
          user: { id: '1', email: 'test@example.com', emailVerified: true },
          updateUser: mockUpdateUser,
        };
        return selector(state);
      });

    const { toJSON } = render(<CodeVerificationScreen />);
    expect(toJSON()).toBeNull();
  });

  it('returns null when there is no user', () => {
    jest
      .spyOn(
        require('#store/useAppStore'),
        'useAppStore',
      )
      .mockImplementation((selector: any) => {
        const state = {
          user: null,
          updateUser: mockUpdateUser,
        };
        return selector(state);
      });

    const { toJSON } = render(<CodeVerificationScreen />);
    expect(toJSON()).toBeNull();
  });
});
