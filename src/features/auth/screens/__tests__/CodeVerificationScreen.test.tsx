jest.mock('#hooks/navigation/useAppNavigation');
const mockAuthNav = {
  navigateToLogin: jest.fn(),
  navigateToForgotPassword: jest.fn(),
};
jest.mock('#features/auth/screens/useAuthNavigation', () => ({
  useAuthNavigation: () => mockAuthNav,
}));
// Whether a mail app opens is the device's to say.
let mockMailAppOpens = false;
const mockOpenMailApp = jest.fn(() => Promise.resolve(true));
jest.mock('#native/mailApp', () => ({
  canOpenMailApp: () => Promise.resolve(mockMailAppOpens),
  openMailApp: () => mockOpenMailApp(),
}));

import React from 'react';
import type { OperationVariables, TypedDocumentNode } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { toastService } from '#/services/toastService';
import { kitTestIDs } from '#components/testIDs';
import { ErrorCode, ErrorDisposition } from '#/graphql/generated/schemaTypes';
import {
  ResendVerificationEmailDocument,
  VerifyEmailDocument,
} from '#operations/auth/auth.generated';
import { recordMock, type RecordedMock } from '#/test-utils/apolloMockProvider';
import { registerTestClient } from '#/test-utils/registeredClient';
import { operationLog } from '#/test-utils/operationLog';
import { authTestIDs } from '#features/auth/testIDs';
import {
  CodeVerificationScreen,
  type VerificationContext,
} from '../CodeVerificationScreen';

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const COOK = {
  id: 'u1',
  email: 'cook@example.com',
  emailVerified: false,
  onBoarded: true,
};
const CODE = '123456';

const verified = () =>
  recordMock(VerifyEmailDocument, {
    data: {
      verifyEmail: {
        __typename: 'VerifyEmailPayload',
        user: { __typename: 'User', id: COOK.id, emailVerified: true },
      },
    },
  });

/** The server's ruling on a code: wrong, spent and expired read alike. */
const refusedCode = () =>
  recordMock(VerifyEmailDocument, {
    data: {
      verifyEmail: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        disposition: ErrorDisposition.Fail,
        message: 'Invalid code',
        field: 'code',
      },
    },
  });

const alreadyVerified = () =>
  recordMock(VerifyEmailDocument, {
    data: {
      verifyEmail: {
        __typename: 'ConflictError',
        code: ErrorCode.EmailAlreadyVerified,
        disposition: ErrorDisposition.Fail,
        message: 'Already verified',
      },
    },
  });

const resent = () =>
  recordMock(ResendVerificationEmailDocument, {
    data: {
      resendVerificationEmail: {
        __typename: 'ResendVerificationEmailPayload',
        user: { __typename: 'User', id: COOK.id },
      },
    },
  });

const unreachable = <TData, TVariables extends OperationVariables>(
  document: TypedDocumentNode<TData, TVariables>,
) => recordMock(document, { error: new Error('Network request failed') });

let log = operationLog();

interface Visit {
  answers?: RecordedMock[];
  email?: string;
  /** Who is signed in; sign-up has no one. */
  user?: typeof COOK | null;
}

async function openCodeEntry(
  context: VerificationContext,
  {
    answers = [],
    email,
    user = context === 'signup' ? null : COOK,
  }: Visit = {},
) {
  useStore.setState({ user, accessToken: user ? 'at' : null });
  const client = registerTestClient(answers, [log.link]);
  const view = render(
    <ApolloProvider client={client}>
      <CodeVerificationScreen context={context} email={email} />
    </ApolloProvider>,
  );
  // The question whether a mail app opens is answered.
  await act(async () => undefined);
  return view;
}

const typeCode = (code = CODE) =>
  fireEvent.changeText(
    screen.getByLabelText(t('auth.verificationCodeInputLabel')),
    code,
  );

/** Presses the alert's button as the person would. */
const answerAlert = (label: string) => {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const button = buttons?.find(each => each.text === label);
  if (!button) throw new Error(`the alert offers no "${label}"`);
  act(() => {
    button.onPress?.();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  log = operationLog();
  mockMailAppOpens = false;
  useStore.getState().clearAuth();
  useStore.setState({ isOnline: true, apiReachable: true });
});

describe('the sign-in gate', () => {
  it('names the address the code went to, with a resend', async () => {
    await openCodeEntry('gate');

    expect(screen.getByText(t('auth.enterCode'))).toBeTruthy();
    expect(screen.getByText(COOK.email)).toBeTruthy();
    expect(screen.getByText(t('labels.submit'))).toBeTruthy();
    expect(
      screen.getByTestId(authTestIDs.codeVerificationResendLink),
    ).toHaveTextContent(`${t('auth.didntGetEmail')} ${t('auth.resendCode')}`);
  });

  it('offers to open Mail where a mail app opens, the code being in the email', async () => {
    mockMailAppOpens = true;
    await openCodeEntry('gate');

    fireEvent.press(screen.getByTestId(authTestIDs.codeVerificationOpenMail));

    expect(mockOpenMailApp).toHaveBeenCalledTimes(1);
  });

  it('offers no Open Mail where no mail app opens', async () => {
    await openCodeEntry('gate');

    expect(
      screen.queryByTestId(authTestIDs.codeVerificationOpenMail),
    ).not.toBeOnTheScreen();
  });

  it('verifies the code once all six digits are in, and lets the user through', async () => {
    const verify = verified();
    const view = await openCodeEntry('gate', { answers: [verify] });

    typeCode();
    await log.landed(VerifyEmailDocument);

    expect(verify.fired).toEqual([
      { input: { code: CODE, email: COOK.email } },
    ]);
    expect(useStore.getState().user?.emailVerified).toBe(true);
    // The root navigator swaps the gate away; it draws nothing meanwhile.
    expect(view.toJSON()).toBeNull();
  });

  it('counts an address already verified as verified', async () => {
    await openCodeEntry('gate', { answers: [alreadyVerified()] });

    typeCode();
    await log.landed(VerifyEmailDocument);

    expect(useStore.getState().user?.emailVerified).toBe(true);
  });

  it('says a refused code under the field, and clears it for the next', async () => {
    await openCodeEntry('gate', { answers: [refusedCode()] });

    typeCode();
    await log.landed(VerifyEmailDocument);

    expect(screen.getByText(t('auth.codeInvalidOrExpired'))).toBeTruthy();
    expect(
      screen.getByLabelText(t('auth.verificationCodeInputLabel')),
    ).toHaveDisplayValue('');
    expect(useStore.getState().user?.emailVerified).toBe(false);
  });

  it('says a code that never reached the server failed, instead of doing nothing', async () => {
    await openCodeEntry('gate', {
      answers: [unreachable(VerifyEmailDocument)],
    });

    typeCode();
    await log.landed(VerifyEmailDocument);

    expect(toastService.error).toHaveBeenCalledWith(
      t('errors.codes.genericRetry'),
    );
  });

  it('asks for six digits before sending anything', async () => {
    const verify = verified();
    await openCodeEntry('gate', { answers: [verify] });

    typeCode('123');
    fireEvent.press(screen.getByText(t('labels.submit')));
    // The resolver checks the code asynchronously.
    await act(async () => undefined);

    expect(screen.getByText(t('auth.codeMustBeSixDigits'))).toBeTruthy();
    expect(verify.fired).toHaveLength(0);
  });

  it('resends to the signed-in address, then waits out a cooldown', async () => {
    const resend = resent();
    await openCodeEntry('gate', { answers: [resend] });
    const link = screen.getByTestId(authTestIDs.codeVerificationResendLink);

    fireEvent.press(link);
    await log.landed(ResendVerificationEmailDocument);
    fireEvent.press(link);

    expect(resend.fired).toEqual([{ input: { email: COOK.email } }]);
    expect(link).toBeDisabled();
    expect(link).toHaveTextContent(/\(\d+s\)/);
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('lets the user through when a resend finds the address already verified', async () => {
    await openCodeEntry('gate', {
      answers: [
        recordMock(ResendVerificationEmailDocument, {
          data: {
            resendVerificationEmail: {
              __typename: 'ConflictError',
              code: ErrorCode.EmailAlreadyVerified,
              disposition: ErrorDisposition.Fail,
              message: 'Already verified',
            },
          },
        }),
      ],
    });

    fireEvent.press(screen.getByTestId(authTestIDs.codeVerificationResendLink));
    await log.landed(ResendVerificationEmailDocument);

    expect(useStore.getState().user?.emailVerified).toBe(true);
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('says a resend that failed, the cooldown already running', async () => {
    await openCodeEntry('gate', {
      answers: [unreachable(ResendVerificationEmailDocument)],
    });

    fireEvent.press(screen.getByTestId(authTestIDs.codeVerificationResendLink));
    await log.landed(ResendVerificationEmailDocument);

    expect(toastService.error).toHaveBeenCalledTimes(1);
  });

  it('asks before signing out, the only way back without a code', async () => {
    const logout = jest.spyOn(authService, 'logout').mockResolvedValue();
    await openCodeEntry('gate');

    fireEvent.press(screen.getByTestId(kitTestIDs.headerBackButton));

    expect(alertService.alert).toHaveBeenCalledWith(
      t('auth.exitVerificationTitle'),
      t('auth.exitVerificationMessage'),
      expect.anything(),
    );
    expect(logout).not.toHaveBeenCalled();
    answerAlert(t('auth.exitVerificationConfirm'));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('states the cost of skipping, and defers verification once confirmed', async () => {
    await openCodeEntry('gate');

    fireEvent.press(screen.getByTestId(authTestIDs.codeVerificationSkipLink));

    expect(alertService.alert).toHaveBeenCalledWith(
      t('auth.skipVerificationTitle'),
      t('auth.skipVerificationMessage'),
      expect.anything(),
    );
    expect(
      useStore.getState().getUserNavigationState(COOK.id)?.verificationSkipped,
    ).toBeFalsy();
    answerAlert(t('auth.skipVerification'));
    expect(
      useStore.getState().getUserNavigationState(COOK.id)?.verificationSkipped,
    ).toBe(true);
  });

  it('draws nothing for a verified user or with no one signed in', async () => {
    const verifiedView = await openCodeEntry('gate', {
      user: { ...COOK, emailVerified: true },
    });
    expect(verifiedView.toJSON()).toBeNull();
    verifiedView.unmount();

    const signedOut = await openCodeEntry('gate', { user: null });
    expect(signedOut.toJSON()).toBeNull();
  });
});

describe('opened from inside the app', () => {
  it('goes back instead of signing out, with no skip: backing out is the skip', async () => {
    const logout = jest.spyOn(authService, 'logout').mockResolvedValue();
    await openCodeEntry('inApp');

    expect(
      screen.queryByTestId(authTestIDs.codeVerificationSkipLink),
    ).not.toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(kitTestIDs.headerBackButton));

    expect(alertService.alert).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('says the address is verified and returns where the user was', async () => {
    await openCodeEntry('inApp', { answers: [verified()] });

    typeCode();
    await log.landed(VerifyEmailDocument);

    expect(useStore.getState().user?.emailVerified).toBe(true);
    expect(toastService.success).toHaveBeenCalledWith(
      t('auth.emailVerifiedToast'),
    );
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('resends to the signed-in address, never a stale one it was handed', async () => {
    const resend = resent();
    await openCodeEntry('inApp', {
      answers: [resend],
      email: 'stale@example.com',
    });

    fireEvent.press(screen.getByTestId(authTestIDs.codeVerificationResendLink));
    await log.landed(ResendVerificationEmailDocument);

    expect(resend.fired).toEqual([{ input: { email: COOK.email } }]);
  });
});

describe('rendered from sign-up, with no session', () => {
  const NEW_ADDRESS = 'new@example.com';

  it('takes the address it was handed, with no back and no skip', async () => {
    await openCodeEntry('signup', { email: NEW_ADDRESS });

    expect(screen.getByText(NEW_ADDRESS)).toBeTruthy();
    expect(
      screen.queryByTestId(kitTestIDs.headerBackButton),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByTestId(authTestIDs.codeVerificationSkipLink),
    ).not.toBeOnTheScreen();
  });

  it('opens inside the first cooldown, so the first tap cannot resend', async () => {
    const resend = resent();
    await openCodeEntry('signup', { email: NEW_ADDRESS, answers: [resend] });
    const link = screen.getByTestId(authTestIDs.codeVerificationResendLink);

    fireEvent.press(link);

    expect(link).toBeDisabled();
    expect(link).toHaveTextContent(/\(\d+s\)/);
    expect(resend.fired).toHaveLength(0);
  });

  it('leaves for sign in from the footer, its only way off', async () => {
    await openCodeEntry('signup', { email: NEW_ADDRESS });

    fireEvent.press(screen.getByTestId(authTestIDs.codeVerificationSignInLink));

    expect(mockAuthNav.navigateToLogin).toHaveBeenCalledTimes(1);
  });

  // A deleted account comes back under its ORIGINAL password, so the one
  // typed at re-registration may not be the one that signs in.
  it('names the account password on the way to sign in, with reset one tap away', async () => {
    const verify = verified();
    await openCodeEntry('signup', { email: NEW_ADDRESS, answers: [verify] });

    typeCode();
    await log.landed(VerifyEmailDocument);

    expect(verify.fired).toEqual([
      { input: { code: CODE, email: NEW_ADDRESS } },
    ]);
    expect(mockAuthNav.navigateToLogin).toHaveBeenCalledTimes(1);
    const [message, options] =
      jest.mocked(toastService.success).mock.lastCall ?? [];
    expect(message).toBe(t('auth.emailVerifiedToastSignIn'));
    expect(options?.action?.label).toBe(t('auth.forgotPassword'));
    options?.action?.onPress();
    expect(mockAuthNav.navigateToForgotPassword).toHaveBeenCalledTimes(1);
  });
});
