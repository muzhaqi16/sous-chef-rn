import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  VerifyEmailDocument,
  ResendVerificationEmailDocument,
} from '#operations/auth/auth.generated';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import type { RootState } from '#store/index';
import type * as UseAppStoreModule from '#store/useAppStore';
import { CodeVerificationScreen } from '../CodeVerificationScreen';

// Typed view over the mocked module so `jest.spyOn` keeps the real signatures
// (the `require` call still returns the runtime-mutable mock object).
const storeModule: typeof UseAppStoreModule = require('#store/useAppStore');

// --- Mocks ---

const mockUpdateUser = jest.fn();
const mockToast = jest.fn();

// Minimal prop shapes consumed by the mocked templates below.
type MockAuthFormTemplateProps = {
  title: string;
  subtitle?: string | React.ReactNode;
  onBackPress?: () => void;
  linkText?: string;
  linkTestID?: string;
  onLinkPress?: () => void;
  submitText: string;
  onSubmit: () => void;
  footerText?: string;
  footerLinkText?: string;
  onFooterLinkPress?: () => void;
  footerLinkDisabled?: boolean;
  footerLinkCountdown?: number;
};

jest.mock('#store/useAppStore', () => {
  const getState = () => ({
    user: {
      id: '1',
      email: 'test@example.com',
      emailVerified: false,
      onBoarded: true,
    },
    updateUser: mockUpdateUser,
  });
  return {
    useAppStore: <T,>(selector: (state: RootState) => T): T =>
      selector(getState() as Partial<RootState> as RootState),
    useUser: () => getState().user,
    useUpdateUser: () => getState().updateUser,
  };
});

jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/authService', () => ({
  authService: { logout: jest.fn() },
}));

const mockSkipVerification = jest.fn();
jest.mock('#hooks/auth/useEmailVerification', () => ({
  useEmailVerificationActions: () => ({
    skipVerification: mockSkipVerification,
    resumeVerification: jest.fn(),
  }),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#components/templates/AuthWrapper', () => {
  const { View } = require('react-native');
  return {
    AuthWrapper: ({ children }: { children?: React.ReactNode }) => (
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
      onBackPress,
      linkText,
      linkTestID,
      onLinkPress,
      submitText,
      onSubmit,
      footerText,
      footerLinkText,
      onFooterLinkPress,
      footerLinkDisabled,
      footerLinkCountdown,
    }: MockAuthFormTemplateProps) => (
      <View testID="auth-form-template">
        {onBackPress ? (
          <Pressable testID="back-button" onPress={onBackPress}>
            <Text>Back</Text>
          </Pressable>
        ) : null}
        <Text>{title}</Text>
        {typeof subtitle === 'string' ? (
          <Text>{subtitle}</Text>
        ) : (
          <View testID="subtitle-container">{subtitle}</View>
        )}
        {linkText ? (
          <Pressable testID={linkTestID} onPress={onLinkPress}>
            <Text>{linkText}</Text>
          </Pressable>
        ) : null}
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
            {(footerLinkCountdown ?? 0) > 0 ? (
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
    const user = userEvent.setup();
    const recordedVariables: Record<string, unknown>[] = [];
    renderWithApollo(<CodeVerificationScreen />, {
      operationMocks: [buildResendMock(recordedVariables), buildVerifyMock()],
    });
    await user.press(screen.getByTestId('footer-link'));
    await waitFor(() => {
      expect(recordedVariables).toContainEqual({
        input: { email: 'test@example.com' },
      });
    });
  });

  it('offers a way back to sign in', async () => {
    const user = userEvent.setup();
    renderWithApollo(<CodeVerificationScreen />);

    await user.press(screen.getByTestId('back-button'));

    expect(alertService.alert).toHaveBeenCalledWith(
      'Go back to sign in?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Sign Out', style: 'destructive' }),
      ]),
    );
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('logs out once the sign-out confirmation is accepted', async () => {
    const user = userEvent.setup();
    renderWithApollo(<CodeVerificationScreen />);

    await user.press(screen.getByTestId('back-button'));

    const buttons = (alertService.alert as jest.Mock).mock.lastCall?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    buttons.find(b => b.text === 'Sign Out')?.onPress?.();

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('warns about the collaboration limits before skipping', async () => {
    const user = userEvent.setup();
    renderWithApollo(<CodeVerificationScreen />);

    await user.press(screen.getByTestId('skip-verification'));

    expect(alertService.alert).toHaveBeenCalledWith(
      'Skip verification?',
      expect.stringContaining("won't be able to share"),
      expect.any(Array),
    );
    expect(mockSkipVerification).not.toHaveBeenCalled();
  });

  it('defers verification once the skip is confirmed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<CodeVerificationScreen />);

    await user.press(screen.getByTestId('skip-verification'));

    const buttons = (alertService.alert as jest.Mock).mock.lastCall?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    buttons.find(b => b.text === 'Skip for now')?.onPress?.();

    expect(mockSkipVerification).toHaveBeenCalledTimes(1);
  });

  it('returns null when user is already verified', () => {
    const verifiedUser = {
      id: '1',
      email: 'test@example.com',
      emailVerified: true,
      onBoarded: true,
    };
    jest.spyOn(storeModule, 'useAppStore').mockImplementation(
      <T,>(selector: (state: RootState) => T): T =>
        selector({
          user: verifiedUser,
          updateUser: mockUpdateUser,
        } as Partial<RootState> as RootState),
    );
    jest.spyOn(storeModule, 'useUser').mockReturnValue(verifiedUser);

    const { toJSON } = renderWithApollo(<CodeVerificationScreen />);
    expect(toJSON()).toBeNull();
  });

  it('returns null when there is no user', () => {
    jest.spyOn(storeModule, 'useAppStore').mockImplementation(
      <T,>(selector: (state: RootState) => T): T =>
        selector({
          user: null,
          updateUser: mockUpdateUser,
        } as Partial<RootState> as RootState),
    );
    jest.spyOn(storeModule, 'useUser').mockReturnValue(null);

    const { toJSON } = renderWithApollo(<CodeVerificationScreen />);
    expect(toJSON()).toBeNull();
  });
});
