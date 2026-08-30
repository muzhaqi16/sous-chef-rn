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
  footerLinkTestID?: string;
  linkDisabled?: boolean;
  linkCountdown?: number;
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

jest.mock('#/services/errorService');

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
  }),
}));

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

const mockNavigateToLogin = jest.fn();
jest.mock('#hooks/navigation/useAuthNavigation', () => ({
  useAuthNavigation: () => ({ navigateToLogin: mockNavigateToLogin }),
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
      footerLinkTestID,
      linkDisabled,
      linkCountdown,
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
          <Pressable
            testID={linkTestID}
            onPress={onLinkPress}
            disabled={linkDisabled}
          >
            <Text>{linkText}</Text>
            {(linkCountdown ?? 0) > 0 ? (
              <Text testID="link-countdown">{linkCountdown}</Text>
            ) : null}
          </Pressable>
        ) : null}
        <Pressable testID="submit-button" onPress={onSubmit}>
          <Text>{submitText}</Text>
        </Pressable>
        {footerText ? <Text>{footerText}</Text> : null}
        {footerLinkText ? (
          <Pressable
            testID={footerLinkTestID ?? 'footer-link'}
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

jest.mock('#components/atoms/SousChefLoader', () => ({
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
          // `UserPayload` is not a member of `ResendVerificationEmailResult`,
          // and the operation selects `user { id }` on the payload — not
          // `success`/`code`, which belong to no member of this union.
          __typename: 'ResendVerificationEmailPayload',
          user: { __typename: 'User', id: 'user-1' },
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
          __typename: 'VerifyEmailPayload',
          user: null,
        },
      },
    },
  };
}

/** Point the store's user hooks at `user` for one test. */
function mockStoreUser(user: Record<string, unknown> | null) {
  jest.spyOn(storeModule, 'useAppStore').mockImplementation(
    <T,>(selector: (state: RootState) => T): T =>
      selector({
        user,
        updateUser: mockUpdateUser,
      } as Partial<RootState> as RootState),
  );
  jest.spyOn(storeModule, 'useUser').mockReturnValue(user as never);
}

describe('CodeVerificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` resets calls but NOT a spy's implementation, so a seeded
    // store would leak into every test after it.
    jest.restoreAllMocks();
  });

  it('renders the enter code title', () => {
    renderWithApollo(<CodeVerificationScreen context="gate" />);
    expect(screen.getByText('Enter Code')).toBeTruthy();
  });

  it('renders the user email in the subtitle', () => {
    renderWithApollo(<CodeVerificationScreen context="gate" />);
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders the submit button', () => {
    renderWithApollo(<CodeVerificationScreen context="gate" />);
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('renders the resend code footer', () => {
    renderWithApollo(<CodeVerificationScreen context="gate" />);
    expect(screen.getByText("Didn't get the email?")).toBeTruthy();
    expect(screen.getByText('Resend code')).toBeTruthy();
  });

  it('fires resend when footer link is pressed', async () => {
    const user = userEvent.setup();
    const recordedVariables: Record<string, unknown>[] = [];
    renderWithApollo(<CodeVerificationScreen context="gate" />, {
      operationMocks: [buildResendMock(recordedVariables), buildVerifyMock()],
    });
    await user.press(screen.getByTestId('resend-code'));
    await waitFor(() => {
      expect(recordedVariables).toContainEqual({
        input: { email: 'test@example.com' },
      });
    });
  });

  it('offers a way back to sign in', async () => {
    const user = userEvent.setup();
    renderWithApollo(<CodeVerificationScreen context="gate" />);

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
    renderWithApollo(<CodeVerificationScreen context="gate" />);

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
    renderWithApollo(<CodeVerificationScreen context="gate" />);

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
    renderWithApollo(<CodeVerificationScreen context="gate" />);

    await user.press(screen.getByTestId('skip-verification'));

    const buttons = (alertService.alert as jest.Mock).mock.lastCall?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    buttons.find(b => b.text === 'Skip for now')?.onPress?.();

    expect(mockSkipVerification).toHaveBeenCalledTimes(1);
  });

  it('returns null when user is already verified', () => {
    mockStoreUser({
      id: '1',
      email: 'test@example.com',
      emailVerified: true,
      onBoarded: true,
    });

    const { toJSON } = renderWithApollo(
      <CodeVerificationScreen context="gate" />,
    );
    expect(toJSON()).toBeNull();
  });

  it('returns null on the gate when there is no user', () => {
    mockStoreUser(null);

    const { toJSON } = renderWithApollo(
      <CodeVerificationScreen context="gate" />,
    );
    expect(toJSON()).toBeNull();
  });

  describe('opened from inside the app', () => {
    it('goes back instead of signing the user out', async () => {
      const user = userEvent.setup();
      renderWithApollo(<CodeVerificationScreen context="inApp" />);

      await user.press(screen.getByTestId('back-button'));

      // The whole point of the pushed screen: changing your mind costs nothing.
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(authService.logout).not.toHaveBeenCalled();
      expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    });

    it('offers no skip link — backing out is the skip', () => {
      renderWithApollo(<CodeVerificationScreen context="inApp" />);
      expect(screen.queryByTestId('skip-verification')).toBeNull();
    });
  });

  describe('rendered from sign-up, with no session', () => {
    it('renders and takes the address it was handed', () => {
      mockStoreUser(null);

      renderWithApollo(
        <CodeVerificationScreen context="signup" email="new@example.com" />,
      );

      expect(screen.getByText('Enter Code')).toBeTruthy();
      expect(screen.getByText('new@example.com')).toBeTruthy();
    });

    it('opens mid-cooldown so the first tap cannot resend', async () => {
      mockStoreUser(null);
      const user = userEvent.setup();
      const recordedVariables: Record<string, unknown>[] = [];
      renderWithApollo(
        <CodeVerificationScreen context="signup" email="new@example.com" />,
        {
          operationMocks: [
            buildResendMock(recordedVariables),
            buildVerifyMock(),
          ],
        },
      );

      // Registration has just sent one, so the screen opens inside the first
      // cooldown. Resend sits in the LINK slot here — the footer carries the
      // way out to sign-in, which is the only exit this context has.
      expect(screen.getByTestId('resend-code')).toBeDisabled();
      expect(screen.getByTestId('link-countdown')).toBeTruthy();
      expect(recordedVariables).toHaveLength(0);

      await user.press(screen.getByTestId('resend-code'));
      expect(recordedVariables).toHaveLength(0);
    });

    it('sends the user to sign in rather than skipping', async () => {
      mockStoreUser(null);
      const user = userEvent.setup();
      renderWithApollo(
        <CodeVerificationScreen context="signup" email="new@example.com" />,
      );

      expect(screen.queryByTestId('skip-verification')).toBeNull();
      // In the FOOTER, not the small right-aligned link slot: with no back
      // button and no skip, it is the only way off this screen.
      await user.press(screen.getByTestId('code-verification-sign-in'));

      expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
    });

    it('has no back button — the account already exists', () => {
      mockStoreUser(null);
      renderWithApollo(
        <CodeVerificationScreen context="signup" email="new@example.com" />,
      );
      expect(screen.queryByTestId('back-button')).toBeNull();
    });

    it('prefers the signed-in address over the one it was handed', async () => {
      const user = userEvent.setup();
      const recordedVariables: Record<string, unknown>[] = [];
      // A session exists, so a stale hand-off must not redirect the resend.
      renderWithApollo(
        <CodeVerificationScreen context="inApp" email="stale@example.com" />,
        {
          operationMocks: [
            buildResendMock(recordedVariables),
            buildVerifyMock(),
          ],
        },
      );

      await user.press(screen.getByTestId('resend-code'));

      await waitFor(() => {
        expect(recordedVariables).toContainEqual({
          input: { email: 'test@example.com' },
        });
      });
    });
  });
});
