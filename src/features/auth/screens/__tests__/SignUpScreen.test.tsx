// The persisted cache lives on the device's disk.
jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));
jest.mock('#native/storage/keychain', () =>
  jest.requireActual('#/test-utils/memoryKeychain').memoryKeychainModule(),
);
// Registering the device runs in the background over native device APIs;
// `deviceRegistration.test.ts` covers it.
jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
jest.mock('#hooks/navigation/useAppNavigation');
const mockAuthNav = {
  navigateToLogin: jest.fn(),
  navigateToForgotPassword: jest.fn(),
};
jest.mock('#features/auth/screens/useAuthNavigation', () => ({
  useAuthNavigation: () => mockAuthNav,
}));
// Whether a mail app opens is the device's to say.
jest.mock('#native/mailApp', () => ({
  canOpenMailApp: () => Promise.resolve(false),
  openMailApp: jest.fn(),
}));

import React from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { ErrorCode, ErrorDisposition } from '#/graphql/generated/schemaTypes';
import {
  LoginDocument,
  RegisterDocument,
  ResendVerificationEmailDocument,
} from '#operations/auth/auth.generated';
import { recordMock, type RecordedMock } from '#/test-utils/apolloMockProvider';
import { registerTestClient } from '#/test-utils/registeredClient';
import { memoryKeychain } from '#/test-utils/memoryKeychain';
import { operationLog } from '#/test-utils/operationLog';
import { registerMobileSessionHost } from '#/app/mobileSessionHost';
import { authTestIDs } from '#features/auth/testIDs';
import { SignUpScreen } from '../SignUpScreen';

registerMobileSessionHost();

const NEW_COOK = {
  name: 'Ada Cook',
  email: 'ada@example.com',
  password: 'Kitchen42x',
};

const registered = (held = false) =>
  recordMock(RegisterDocument, {
    held,
    data: {
      register: {
        __typename: 'RegisterPayload',
        message: 'A verification link was sent.',
      },
    },
  });

const signedIn = () =>
  recordMock(LoginDocument, {
    data: {
      login: {
        __typename: 'AuthPayload',
        accessToken: 'at',
        refreshToken: 'rt',
        user: {
          __typename: 'User',
          id: 'u1',
          email: NEW_COOK.email,
          emailVerified: false,
          onBoarded: false,
        },
      },
    },
  });

/** The address is another account's, or a deleted one's: it refuses this password. */
const refusedSignIn = () =>
  recordMock(LoginDocument, {
    data: {
      login: {
        __typename: 'AuthenticationError',
        code: ErrorCode.AuthCredentialsInvalid,
        disposition: ErrorDisposition.Fail,
        message: 'Refused',
      },
    },
  });

const resend = () =>
  recordMock(ResendVerificationEmailDocument, {
    data: {
      resendVerificationEmail: {
        __typename: 'ResendVerificationEmailPayload',
        user: { __typename: 'User', id: 'u1' },
      },
    },
  });

let log = operationLog();

function openSignUp(answers: RecordedMock[] = []) {
  const client = registerTestClient(answers, [log.link]);
  return render(
    <ApolloProvider client={client}>
      <SignUpScreen />
    </ApolloProvider>,
  );
}

function fillIn(values: Partial<typeof NEW_COOK> = NEW_COOK) {
  const typeInto = (testID: string, value: string | undefined) => {
    if (value !== undefined) {
      fireEvent.changeText(screen.getByTestId(testID), value);
    }
  };
  typeInto(authTestIDs.signUpNameInput, values.name);
  typeInto(authTestIDs.signUpEmailInput, values.email);
  typeInto(authTestIDs.signUpPasswordInput, values.password);
}

const submit = () =>
  fireEvent.press(screen.getByTestId(authTestIDs.signUpSubmitButton));

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  memoryKeychain.reset();
  useStore.getState().clearAuth();
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    authIsLoading: false,
    navigationState: 'auth',
  });
});

it('asks for a name, an email and a new password, and links to sign in', () => {
  openSignUp();

  expect(screen.getByText(t('auth.signupTitle'))).toBeTruthy();
  expect(screen.getByText(t('auth.signupSubtitle'))).toBeTruthy();
  expect(screen.getByTestId(authTestIDs.signUpNameInput)).toBeTruthy();
  expect(screen.getByTestId(authTestIDs.signUpEmailInput)).toBeTruthy();
  expect(screen.getByTestId(authTestIDs.signUpPasswordInput)).toBeTruthy();
  fireEvent.press(screen.getByTestId(authTestIDs.signUpLoginLink));

  expect(mockAuthNav.navigateToLogin).toHaveBeenCalledTimes(1);
});

it('reports what is missing on the fields, and sends nothing', async () => {
  const register = registered();
  openSignUp([register]);

  fillIn({ email: 'not-an-address', password: 'short' });
  await act(async () => {
    submit();
  });

  expect(screen.getByText(t('auth.fullNameRequired'))).toBeTruthy();
  expect(screen.getByText(t('commonValidation.passwordMin'))).toBeTruthy();
  expect(register.fired).toHaveLength(0);
});

it('creates the account with what was typed, leaving the signed-in account to the verification gate', async () => {
  const register = registered();
  const login = signedIn();
  openSignUp([register, login]);

  fillIn();
  submit();
  await log.landed(LoginDocument);

  expect(register.fired).toEqual([{ input: NEW_COOK }]);
  expect(login.fired).toEqual([
    { input: { email: NEW_COOK.email, password: NEW_COOK.password } },
  ]);
  expect(useStore.getState().navigationState).toBe('verification');
  expect(
    screen.queryByTestId(authTestIDs.codeVerificationScreen),
  ).not.toBeOnTheScreen();
});

it('says the account is being created until the server answers', async () => {
  const register = registered(true);
  openSignUp([register, signedIn()]);

  fillIn();
  submit();
  await log.requested(RegisterDocument);
  await act(async () => undefined);

  const button = screen.getByTestId(authTestIDs.signUpSubmitButton);
  expect(button).toHaveAccessibleName(t('auth.creatingAccount'));
  expect(button).toBeBusy();

  register.release();
  await log.landed(LoginDocument);
});

describe('an address that refuses the new password', () => {
  // Taken, or a deleted account's: the mail carries a code AND a link, so the
  // code can be entered here rather than leaving for the inbox.
  it('offers code entry for that address', async () => {
    openSignUp([registered(), refusedSignIn()]);

    fillIn();
    submit();
    await log.landed(LoginDocument);

    expect(screen.getByTestId(authTestIDs.codeVerificationScreen)).toBeTruthy();
    expect(screen.getByText(t('auth.enterCode'))).toBeTruthy();
    expect(screen.getByText(NEW_COOK.email)).toBeTruthy();
    expect(useStore.getState().user).toBeNull();
  });

  it('opens inside the first cooldown, the mail having just gone out', async () => {
    const resent = resend();
    openSignUp([registered(), refusedSignIn(), resent]);

    fillIn();
    submit();
    await log.landed(LoginDocument);
    const resendLink = screen.getByTestId(
      authTestIDs.codeVerificationResendLink,
    );
    fireEvent.press(resendLink);

    expect(resendLink).toBeDisabled();
    expect(resent.fired).toHaveLength(0);
  });
});

it('stays on the form when the account cannot be created', async () => {
  openSignUp([
    recordMock(RegisterDocument, {
      error: new Error('Network request failed'),
    }),
  ]);

  fillIn();
  submit();
  await log.landed(RegisterDocument);

  expect(toastService.error).toHaveBeenCalledWith(
    t('errors.codes.genericRetry'),
  );
  expect(screen.getByTestId(authTestIDs.signUpScreen)).toBeTruthy();
  expect(
    screen.queryByTestId(authTestIDs.codeVerificationScreen),
  ).not.toBeOnTheScreen();
  expect(
    screen.getByTestId(authTestIDs.signUpSubmitButton),
  ).toHaveAccessibleName(t('auth.signUp'));
});
