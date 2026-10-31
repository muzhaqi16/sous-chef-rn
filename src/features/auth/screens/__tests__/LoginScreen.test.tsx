import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { biometricService } from '#/services/biometric/deviceCredential';
import { toastService } from '#/services/toastService';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { LoginScreen } from '../LoginScreen';
import { useStore } from '#store';

// --- Mocks ---

// LoginScreen drives login through `authService` and biometrics through
// `biometricService` directly; it only
// consumes `useRememberMe` for the remember-login prompt.
// `mockRealRememberMe` swaps the real hook in for the enrolment cases.
let mockRealRememberMe = false;
const mockShowRememberMePrompt = jest.fn();
jest.mock('#features/auth/hooks/useRememberMe', () => ({
  useRememberMe: (
    events: Parameters<
      typeof import('#features/auth/hooks/useRememberMe').useRememberMe
    >[0],
  ) =>
    mockRealRememberMe
      ? jest
          .requireActual<typeof import('#features/auth/hooks/useRememberMe')>(
            '#features/auth/hooks/useRememberMe',
          )
          .useRememberMe(events)
      : // A new closure per render, as a changed `t` or store action gives.
        {
          showRememberMePrompt: (
            credentials: import('#features/auth/hooks/useRememberMe').RememberMeCredentials,
          ) => mockShowRememberMePrompt(credentials),
        },
}));

const mockNavigateToForgotPassword = jest.fn();
const mockNavigateToSignUp = jest.fn();
const mockNavigateToLogin = jest.fn();

jest.mock('#features/auth/screens/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToForgotPassword: mockNavigateToForgotPassword,
    navigateToSignUp: mockNavigateToSignUp,
    // Reached from the verification screen this one swaps in. It resolves to
    // the route already focused, which is why the exit needs the host too.
    navigateToLogin: mockNavigateToLogin,
  }),
}));

jest.mock('#features/auth/components/AuthWrapper', () => {
  const { View } = require('react-native');
  return {
    AuthWrapper: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => <View testID={testID}>{children}</View>,
  };
});

jest.mock('#features/auth/components/AuthFormTemplate', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    AuthFormTemplate: ({
      title,
      subtitle,
      submitText,
      submitButtonTestID,
      onSubmit,
      linkText,
      linkTestID,
      onLinkPress,
      footerText,
      footerLinkText,
      footerLinkTestID,
      onFooterLinkPress,
    }: {
      title?: string;
      subtitle?: string;
      submitText?: string;
      submitButtonTestID?: string;
      onSubmit?: () => void;
      linkText?: string;
      linkTestID?: string;
      onLinkPress?: () => void;
      footerText?: string;
      footerLinkText?: string;
      footerLinkTestID?: string;
      onFooterLinkPress?: () => void;
    }) => (
      <View testID="auth-form-template">
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        <Pressable testID={submitButtonTestID} onPress={onSubmit}>
          <Text>{submitText}</Text>
        </Pressable>
        {linkText ? (
          <Pressable testID={linkTestID} onPress={onLinkPress}>
            <Text>{linkText}</Text>
          </Pressable>
        ) : null}
        {footerText ? <Text>{footerText}</Text> : null}
        {footerLinkText ? (
          <Pressable testID={footerLinkTestID} onPress={onFooterLinkPress}>
            <Text>{footerLinkText}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

jest.mock('#components/atoms/Icon', () => ({
  Icon: 'Icon',
}));

// A REAL yup schema, permissive: `yupResolver` calls schema methods, so a plain
// `{}` throws the moment a submit actually validates — which no test did until
// the refusal tests below. Permissive because the mocked AuthFormTemplate
// renders no inputs to type into; the login rules themselves are covered by
// `utils/validation/__tests__/auth`.
jest.mock('#/utils/validation/auth', () => {
  const yup = jest.requireActual('yup');
  return {
    // Spread, not replace: the screen this routes to on a refusal builds its
    // own schema from the same module.
    ...jest.requireActual('#/utils/validation/auth'),
    loginSchema: yup.object({}),
  };
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The mount check cannot answer for a slot proven unusable AFTER it, and the
  // affordance is the only thing offering a credential that is already dead.
  it('takes the biometric affordance down when the slot is forgotten', async () => {
    jest
      .spyOn(biometricService, 'getLastBiometricEmail')
      .mockResolvedValue('chef@example.com');
    jest
      .spyOn(biometricService, 'checkStoredCredentials')
      .mockResolvedValue(true);
    jest.spyOn(biometricService, 'getBiometricInfo').mockResolvedValue({
      isAvailable: true,
      biometryType: 'Fingerprint',
    });
    useStore.getState().setHasStoredCredentials(true);

    render(<LoginScreen />);
    await drainTimers();
    const button = screen.getByLabelText(
      /fingerprint|biometric|touch id|face id/i,
    );
    expect(button).toBeTruthy();

    // What `forgetBiometricSlot` writes when a slot is proven unusable. That
    // it writes it is covered in biometric/__tests__/deviceCredential; this is the
    // half that decides whether the affordance is still offered.
    useStore.getState().setHasStoredCredentials(false);

    await drainTimers();
    expect(
      screen.queryByLabelText(/fingerprint|biometric|touch id|face id/i),
    ).toBeNull();
  });

  it('renders the login screen container', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('login-screen')).toBeTruthy();
  });

  it('renders the sign in title', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Sign in to Sous Chef')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Access your pantry and more')).toBeTruthy();
  });

  it('renders the submit button with Log In text', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Log In')).toBeTruthy();
    expect(screen.getByTestId('login-submit-button')).toBeTruthy();
  });

  it('renders the forgot password link', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('navigates to forgot password when link is pressed', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.press(screen.getByTestId('login-forgot-password-link'));
    expect(mockNavigateToForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('renders sign up footer link', () => {
    render(<LoginScreen />);
    expect(screen.getByText("Don't have an account?")).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('navigates to sign up when footer link is pressed', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.press(screen.getByTestId('login-signup-link'));
    expect(mockNavigateToSignUp).toHaveBeenCalledTimes(1);
  });

  // AUTH_EMAIL_NOT_VERIFIED is a 403 that leaves the credential valid, and the
  // emailed code is what clears it. Left as a toast on this form, the only
  // thing the reader can do is submit the same password again.
  it('offers code entry when the mailbox is unverified', async () => {
    const loginSpy = jest
      .spyOn(authService, 'login')
      .mockImplementation(async (_input, options) => {
        options?.onRefusal?.('AUTH_EMAIL_NOT_VERIFIED');
        return false;
      });
    const user = userEvent.setup();
    // Apollo-wrapped: the screen it routes to owns the verify mutation.
    renderWithApollo(<LoginScreen />);

    await user.press(screen.getByTestId('login-submit-button'));

    await drainTimers();
    expect(screen.getByTestId('code-verification-screen')).toBeTruthy();
    // Not a sign-out: nothing cleared the stored credentials on the way here.
    expect(loginSpy).toHaveBeenCalledTimes(1);
    loginSpy.mockRestore();
  });

  // Every exit from the in-place verification screen navigates to Login, which
  // is the route already focused — so nothing re-renders and the state that put
  // the screen there survives. Without a host dismissal there is no way off it.
  it('lets the reader back out of the verification screen it swaps in', async () => {
    const loginSpy = jest
      .spyOn(authService, 'login')
      .mockImplementation(async (_input, options) => {
        options?.onRefusal?.('AUTH_EMAIL_NOT_VERIFIED');
        return false;
      });
    const user = userEvent.setup();
    renderWithApollo(<LoginScreen />);

    await user.press(screen.getByTestId('login-submit-button'));
    await drainTimers();
    expect(screen.getByTestId('code-verification-screen')).toBeTruthy();

    // The footer sign-in link is this context's documented way out.
    await user.press(screen.getByTestId('code-verification-sign-in'));

    await drainTimers();
    expect(screen.getByTestId('login-screen')).toBeTruthy();
    expect(screen.queryByTestId('code-verification-screen')).toBeNull();
    loginSpy.mockRestore();
  });

  it('stays on the form for a refusal with nowhere to go', async () => {
    const loginSpy = jest
      .spyOn(authService, 'login')
      .mockImplementation(async (_input, options) => {
        options?.onRefusal?.('AUTH_CREDENTIALS_INVALID');
        return false;
      });
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.press(screen.getByTestId('login-submit-button'));

    await drainTimers();
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('code-verification-screen')).toBeNull();
    expect(screen.getByTestId('login-screen')).toBeTruthy();
    loginSpy.mockRestore();
  });
});

describe('LoginScreen remembering the sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealRememberMe = true;
  });
  afterEach(() => {
    mockRealRememberMe = false;
    jest.restoreAllMocks();
  });

  it('says so when the sign-in could not be saved, and still enters the app', async () => {
    jest
      .spyOn(jest.requireActual('#/services/auth/deviceId'), 'ensureDeviceId')
      .mockResolvedValue(null);
    const alert = jest.mocked(alertService.alert);
    useStore.getState().setPostLoginCredentials({ email: 'chef@example.com' });

    render(<LoginScreen />);
    await drainTimers();
    expect(alert).toHaveBeenCalled();
    // Button 1 is "Remember".
    const [, , buttons] = alert.mock.calls[0] ?? [];
    buttons?.[1]?.onPress?.();

    await drainTimers();
    expect(toastService.error).toHaveBeenCalledWith(
      'Failed to save login information',
    );
    expect(useStore.getState().navigationState).toBe('main_app');
  });
});

describe('LoginScreen remember-login prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    useStore.getState().setPostLoginCredentials(null);
  });

  it('prompts once per sign-in however often the prompt closure changes', async () => {
    useStore.getState().setPostLoginCredentials({ email: 'chef@example.com' });

    const { rerender } = render(<LoginScreen />);
    rerender(<LoginScreen />);
    rerender(<LoginScreen />);

    await drainTimers();
    expect(mockShowRememberMePrompt).toHaveBeenCalled();
    expect(mockShowRememberMePrompt).toHaveBeenCalledTimes(1);
  });
});
