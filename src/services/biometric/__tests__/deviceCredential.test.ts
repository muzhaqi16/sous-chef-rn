// Biometric credentials must NOT survive a sign-out: the slot is
// `ACCESS_CONTROL.BIOMETRY_ANY`, which any enrolled biometric satisfies, so on a
// shared device the next person's finger would unlock the previous account. A
// caller that wants the slot kept passes `keepBiometricCredentials: true`.

jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));
jest.mock('#native/storage/keychain', () =>
  jest.requireActual('#/test-utils/memoryKeychain').memoryKeychainModule(),
);

import { ApolloLink } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { recordMock, type MockDataFor } from '#/test-utils/apolloMockProvider';
import { registerTestClient } from '#/test-utils/registeredClient';
import { memoryKeychain } from '#/test-utils/memoryKeychain';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
import { toastService } from '#/services/toastService';
import * as deviceIdentity from '#/services/auth/deviceId';
import {
  ErrorCode,
  ErrorDisposition,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import {
  ExchangeDeviceCredentialDocument,
  IssueDeviceCredentialDocument,
  MyDeviceCredentialsDocument,
  RevokeDeviceCredentialDocument,
} from '#operations/auth/auth.generated';
import { authService } from '#/services/authService';
import {
  biometricService,
  renewStoredSignIn,
} from '#/services/biometric/deviceCredential';
import { registerMobileSessionHost } from '#/app/mobileSessionHost';

// A sign-out drops the slot through the step the app registers.
registerMobileSessionHost();

const EMAIL = 'chef@example.com';
const SLOT = 'dc1:secret';

let log = operationLog();
let thisDevice = '';

type ListedCredential = NonNullable<
  MockDataFor<typeof MyDeviceCredentialsDocument>['deviceCredentials']
>[number];

const listing = (...deviceIds: string[]) =>
  recordMock(MyDeviceCredentialsDocument, {
    data: {
      deviceCredentials: deviceIds.map(
        (deviceId, index): ListedCredential => ({
          __typename: 'DeviceCredential',
          id: `dc-${index}`,
          deviceId,
        }),
      ),
    },
  });

const revoking = () =>
  recordMock(RevokeDeviceCredentialDocument, {
    data: {
      revokeDeviceCredential: { __typename: 'RevokeDeviceCredentialPayload' },
    },
  });

const issuing = (credential = 'issued') =>
  recordMock(IssueDeviceCredentialDocument, {
    data: {
      issueDeviceCredential: {
        __typename: 'DeviceCredentialPayload',
        credential,
      },
    },
  });

const exchangeRefused = (
  __typename: 'AuthenticationError' | 'ValidationError',
  code: ErrorCode,
) =>
  recordMock(ExchangeDeviceCredentialDocument, {
    data: {
      exchangeDeviceCredential: {
        __typename,
        code,
        disposition: ErrorDisposition.Fail,
        message: 'Refused',
      },
    },
  });

/** Answers over a client registered as the app's, every operation logged. */
const serve = (...answers: ReturnType<typeof recordMock>[]) =>
  registerTestClient(answers, [log.link]);

/** This device has no id, as when its storage is unavailable. */
const noDeviceId = () =>
  jest.spyOn(deviceIdentity, 'ensureDeviceId').mockResolvedValueOnce(null);

/** Resolves when the logger warns with `text`. */
const warned = (text: string) =>
  new Promise<void>(resolve => {
    jest.spyOn(logger, 'warn').mockImplementation(message => {
      if (typeof message === 'string' && message.includes(text)) resolve();
    });
  });

beforeAll(async () => {
  thisDevice = (await deviceIdentity.ensureDeviceId()) ?? '';
});

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  log = operationLog();
  memoryKeychain.reset();
  memoryKeychain.hold(EMAIL, SLOT);
  useStore.setState({
    user: { id: 'u1', email: EMAIL, emailVerified: true, onBoarded: true },
    isOnline: true,
    apiReachable: true,
    biometricRetryAt: 0,
    hasStoredCredentials: true,
  });
});

describe('a sign-out', () => {
  // The session end is its own suite's; here only that it ran matters.
  const endSession = jest.fn(async () => undefined);

  beforeEach(() => {
    endSession.mockClear();
    useStore.setState({ endSession });
  });

  it('clears the stored sign-in, revoking it first', async () => {
    const revoke = revoking();
    serve(listing('other-device', thisDevice), revoke);

    await authService.logout();

    expect(memoryKeychain.slotOf(EMAIL)).toBeUndefined();
    expect(revoke.fired).toEqual([{ input: { id: 'dc-1' } }]);
    expect(endSession).toHaveBeenCalledWith(
      'signed_out',
      expect.objectContaining({ deliberate: expect.any(Object) }),
    );
  });

  it('keeps it, unrevoked, only when the caller opts in', async () => {
    const revoke = revoking();
    serve(listing(thisDevice), revoke);

    await authService.logout({ keepBiometricCredentials: true });

    expect(memoryKeychain.slotOf(EMAIL)).toBe(SLOT);
    expect(revoke.fired).toEqual([]);
  });

  it('says so when the stored sign-in could not be deleted', async () => {
    const error = jest.spyOn(logger, 'error');
    memoryKeychain.failNextClear(new Error('keychain locked'));
    serve(listing());

    await authService.logout();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('could not be removed'),
    );
  });
});

describe("revoking this device's credential", () => {
  it('opts its round trips out of the sign-out refusal', async () => {
    const contexts: Record<string, unknown>[] = [];
    registerTestClient(
      [listing(thisDevice), revoking()],
      [
        new ApolloLink((operation, forward) => {
          contexts.push(operation.getContext());
          return forward(operation);
        }),
      ],
    );

    expect(await biometricService.revokeDeviceCredentialForThisDevice()).toBe(
      true,
    );
    expect(contexts).toHaveLength(2);
    for (const context of contexts) {
      expect(context).toMatchObject({ allowDuringLogout: true });
    }
  });

  it('says it could not when this device has no id', async () => {
    const revoke = revoking();
    serve(listing(thisDevice), revoke);
    noDeviceId();

    expect(await biometricService.revokeDeviceCredentialForThisDevice()).toBe(
      false,
    );
    expect(revoke.fired).toEqual([]);
  });

  it('reads a refusal as not revoked', async () => {
    serve(
      listing(thisDevice),
      recordMock(RevokeDeviceCredentialDocument, {
        data: {
          revokeDeviceCredential: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            disposition: ErrorDisposition.Fail,
            message: 'No',
          },
        },
      }),
    );

    expect(await biometricService.revokeDeviceCredentialForThisDevice()).toBe(
      false,
    );
  });

  it('finds nothing to revoke where this device holds none', async () => {
    const revoke = revoking();
    serve(listing('other-device'), revoke);

    expect(await biometricService.revokeDeviceCredentialForThisDevice()).toBe(
      true,
    );
    expect(revoke.fired).toEqual([]);
  });

  it('is not tried while the API is unreachable', async () => {
    useStore.setState({ apiReachable: false });
    const asked = listing(thisDevice);
    serve(asked);

    expect(await biometricService.revokeDeviceCredentialForThisDevice()).toBe(
      false,
    );
    expect(asked.fired).toEqual([]);
  });
});

describe('a fingerprint sign-in', () => {
  it('presents this device and signs in', async () => {
    const exchange = recordMock(ExchangeDeviceCredentialDocument, {
      data: {
        exchangeDeviceCredential: {
          __typename: 'DeviceCredentialSessionPayload',
          accessToken: 'at',
          refreshToken: 'rt',
          user: {
            __typename: 'User',
            id: 'u1',
            email: EMAIL,
            emailVerified: true,
            onBoarded: true,
          },
        },
      },
    });
    serve(exchange);
    useStore.setState({ biometricAttempts: 2 });

    expect(await biometricService.signInWithDeviceCredential(EMAIL)).toBe(true);
    expect(exchange.fired).toEqual([
      { input: { credential: 'secret', deviceId: thisDevice } },
    ]);
    expect(useStore.getState().biometricAttempts).toBe(0);
  });

  it('says why when it cannot even be attempted', async () => {
    serve();
    noDeviceId();

    expect(await biometricService.signInWithDeviceCredential(EMAIL)).toBe(
      false,
    );
    expect(toastService.error).toHaveBeenCalledWith(
      t('auth.biometricUnavailableOnDevice'),
    );
  });

  it('holds the next attempt off after a refusal, rather than re-spending', async () => {
    const exchange = exchangeRefused(
      'AuthenticationError',
      ErrorCode.AuthCredentialsInvalid,
    );
    serve(exchange);

    await biometricService.signInWithDeviceCredential(EMAIL);
    expect(useStore.getState().biometricRetryAt).toBeGreaterThan(Date.now());

    expect(await biometricService.signInWithDeviceCredential(EMAIL)).toBe(
      false,
    );
    expect(exchange.fired).toHaveLength(1);
    expect(toastService.error).toHaveBeenLastCalledWith(
      expect.stringContaining('Too many attempts'),
    );
    expect(memoryKeychain.slotOf(EMAIL)).toBe(SLOT);
  });

  it("holds the next attempt off until the server's own retry deadline", async () => {
    serve(
      recordMock(ExchangeDeviceCredentialDocument, {
        error: new CombinedGraphQLErrors({
          data: null,
          errors: [
            {
              message: 'Too many attempts',
              extensions: {
                code: TopLevelErrorCode.OperationRateLimited,
                retryAfter: 90,
              },
            },
          ],
        }),
      }),
    );
    const before = Date.now();

    expect(await biometricService.signInWithDeviceCredential(EMAIL)).toBe(
      false,
    );
    expect(useStore.getState().biometricRetryAt).toBeGreaterThanOrEqual(
      before + 90_000,
    );
    expect(memoryKeychain.slotOf(EMAIL)).toBe(SLOT);
  });

  it('takes the button down when the slot is empty, and says why', async () => {
    memoryKeychain.reset();
    serve();

    expect(await biometricService.signInWithDeviceCredential(EMAIL)).toBe(
      false,
    );
    expect(useStore.getState().hasStoredCredentials).toBe(false);
    expect(toastService.error).toHaveBeenCalledWith(
      t('auth.biometricNeedsSetupAgain'),
    );
  });

  it('takes the button down when the read finds the slot unusable', async () => {
    memoryKeychain.invalidateOnRead();
    serve();

    await biometricService.signInWithDeviceCredential(EMAIL);

    expect(useStore.getState().hasStoredCredentials).toBe(false);
  });

  it('keeps the button when the read failed but the slot survived', async () => {
    memoryKeychain.promptAnswers('unavailable');
    serve();

    await biometricService.signInWithDeviceCredential(EMAIL);

    expect(useStore.getState().hasStoredCredentials).toBe(true);
  });

  it('ends quietly, slot and button kept, when the prompt is dismissed', async () => {
    memoryKeychain.promptAnswers('cancelled');
    const exchange = exchangeRefused(
      'AuthenticationError',
      ErrorCode.AuthCredentialsInvalid,
    );
    serve(exchange);

    expect(await biometricService.signInWithDeviceCredential(EMAIL)).toBe(
      false,
    );
    expect(toastService.error).not.toHaveBeenCalled();
    expect(exchange.fired).toEqual([]);
    expect(memoryKeychain.slotOf(EMAIL)).toBe(SLOT);
    expect(useStore.getState().hasStoredCredentials).toBe(true);
  });

  it('clears a slot written before device credentials, and says why', async () => {
    memoryKeychain.hold(EMAIL, 'a-plain-password');
    serve();

    await biometricService.signInWithDeviceCredential(EMAIL);

    expect(memoryKeychain.slotOf(EMAIL)).toBeUndefined();
    expect(toastService.error).toHaveBeenCalledWith(
      t('auth.biometricNeedsSetupAgain'),
    );
  });

  it('drops the slot when the server calls the credential dead', async () => {
    serve(
      exchangeRefused(
        'AuthenticationError',
        ErrorCode.AuthDeviceCredentialInvalid,
      ),
    );

    await biometricService.signInWithDeviceCredential(EMAIL);

    expect(memoryKeychain.slotOf(EMAIL)).toBeUndefined();
    expect(useStore.getState().hasStoredCredentials).toBe(false);
  });

  it.each([
    [
      'fails on transport',
      recordMock(ExchangeDeviceCredentialDocument, {
        error: new Error('Network request failed'),
      }),
    ],
    [
      'is refused as credentials-invalid',
      exchangeRefused('AuthenticationError', ErrorCode.AuthCredentialsInvalid),
    ],
  ])('keeps the slot when the exchange %s', async (_, answer) => {
    serve(answer);

    await biometricService.signInWithDeviceCredential(EMAIL);

    expect(memoryKeychain.slotOf(EMAIL)).toBe(SLOT);
  });
});

describe('an enrolment', () => {
  it('stores the credential issued and offers the button', async () => {
    memoryKeychain.reset();
    useStore.setState({ hasStoredCredentials: false });
    const issue = issuing('fresh');
    serve(issue);

    expect(await biometricService.enrolDeviceCredential(EMAIL)).toBe(
      'enrolled',
    );
    expect(issue.fired).toEqual([{ input: { deviceId: thisDevice } }]);
    expect(memoryKeychain.slotOf(EMAIL)).toBe('dc1:fresh');
    expect(useStore.getState().hasStoredCredentials).toBe(true);
  });

  it('reports an unsaved credential without a word, revoking it', async () => {
    memoryKeychain.reset();
    useStore.setState({ hasStoredCredentials: false });
    memoryKeychain.failNextSave(new Error('keystore unavailable'));
    const revoke = revoking();
    serve(issuing(), listing(thisDevice), revoke);

    expect(await biometricService.enrolDeviceCredential(EMAIL)).toBe('unsaved');
    await log.requested(RevokeDeviceCredentialDocument);

    expect(revoke.fired).toEqual([{ input: { id: 'dc-0' } }]);
    expect(useStore.getState().hasStoredCredentials).toBe(false);
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('notes a credential that may still be live when its revoke cannot reach the server', async () => {
    memoryKeychain.failNextSave(new Error('keystore unavailable'));
    const revoke = revoking();
    serve(
      issuing(),
      recordMock(MyDeviceCredentialsDocument, {
        error: new Error('Network request failed'),
      }),
      revoke,
    );
    const possiblyLive = warned('could not store may still be live');

    expect(await biometricService.enrolDeviceCredential(EMAIL)).toBe('unsaved');
    await possiblyLive;

    expect(revoke.fired).toEqual([]);
  });

  it('reports a refused issue as refused, storing nothing', async () => {
    memoryKeychain.reset();
    serve(
      recordMock(IssueDeviceCredentialDocument, {
        data: {
          issueDeviceCredential: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            disposition: ErrorDisposition.Fail,
            message: 'No',
          },
        },
      }),
    );

    expect(await biometricService.enrolDeviceCredential(EMAIL)).toBe('refused');
    expect(memoryKeychain.slotOf(EMAIL)).toBeUndefined();
  });

  it('sends nothing for a device with no id', async () => {
    const issue = issuing();
    serve(issue);
    noDeviceId();

    expect(await biometricService.enrolDeviceCredential(EMAIL)).toBe('unsaved');
    expect(issue.fired).toEqual([]);
  });
});

// Sign-out and Settings both remove the slot this way, so the login screen's
// button follows the slot whichever of them ran.
describe('removing a stored sign-in', () => {
  it('takes the button down once the slot is gone', async () => {
    serve(listing());

    expect(await biometricService.forgetStoredSignIn(EMAIL)).toBe(true);
    expect(memoryKeychain.slotOf(EMAIL)).toBeUndefined();
    expect(useStore.getState().hasStoredCredentials).toBe(false);
  });

  it('answers false, and keeps the button, while the slot is still there', async () => {
    memoryKeychain.failNextClear(new Error('keychain busy'));
    serve(listing());

    expect(await biometricService.forgetStoredSignIn(EMAIL)).toBe(false);
    expect(useStore.getState().hasStoredCredentials).toBe(true);
  });

  it('removes the slot within its budget when the server never answers', async () => {
    serve(recordMock(MyDeviceCredentialsDocument, { held: true }));

    expect(await biometricService.forgetStoredSignIn(EMAIL)).toBe(true);
    expect(memoryKeychain.slotOf(EMAIL)).toBeUndefined();
  });
});

// A password change this session survived revoked every device credential, so
// a slot left as it was would fail on the next fingerprint sign-in.
describe('renewing a stored sign-in after a password change', () => {
  it('issues nothing for an account with no slot', async () => {
    memoryKeychain.reset();
    const issue = issuing();
    serve(issue);

    expect(await renewStoredSignIn(EMAIL)).toBe('none');
    expect(issue.fired).toEqual([]);
  });

  it('stores a freshly issued credential in the slot', async () => {
    serve(issuing('renewed'));

    expect(await renewStoredSignIn(EMAIL)).toBe('renewed');
    expect(memoryKeychain.slotOf(EMAIL)).toBe('dc1:renewed');
  });

  it('drops the slot quietly when no new credential can be issued', async () => {
    serve(
      recordMock(IssueDeviceCredentialDocument, {
        data: {
          issueDeviceCredential: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            disposition: ErrorDisposition.Fail,
            message: 'No live session',
          },
        },
      }),
    );

    expect(await renewStoredSignIn(EMAIL)).toBe('dropped');
    expect(memoryKeychain.slotOf(EMAIL)).toBeUndefined();
    expect(useStore.getState().hasStoredCredentials).toBe(false);
    // The password change's own message says the sign-in is off.
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('revokes a renewal it could not save', async () => {
    memoryKeychain.failNextSave(new Error('save prompt cancelled'));
    const revoke = revoking();
    serve(issuing(), listing(thisDevice), revoke);

    expect(await renewStoredSignIn(EMAIL)).toBe('dropped');
    await log.requested(RevokeDeviceCredentialDocument);

    expect(revoke.fired).toHaveLength(1);
  });
});
