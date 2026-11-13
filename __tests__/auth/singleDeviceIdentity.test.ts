// One device identity, not one per feature: the header, the socket, device
// registration and the device credential all present the same value. Two of
// them diverging is invisible to typecheck and to every other suite — each one
// keeps passing against its own id.

jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));
jest.mock('#native/storage/keychain', () =>
  jest.requireActual('#/test-utils/memoryKeychain').memoryKeychainModule(),
);

import { print } from 'graphql';
import { recordMock } from '#/test-utils/apolloMockProvider';
import { registerTestClient } from '#/test-utils/registeredClient';
import { memoryKeychain } from '#/test-utils/memoryKeychain';
import { useStore } from '#store';
import { ensureDeviceId, getDeviceId } from '#/services/auth/deviceId';
import { biometricService } from '#/services/biometric/deviceCredential';
import { ErrorCode, ErrorDisposition } from '#/graphql/generated/schemaTypes';
import {
  ExchangeDeviceCredentialDocument,
  IssueDeviceCredentialDocument,
  LoginDocument,
  MyDeviceCredentialsDocument,
  RevokeDeviceCredentialDocument,
} from '#operations/auth/auth.generated';

const EMAIL = 'chef@example.com';

let thisDevice = '';

beforeAll(async () => {
  thisDevice = (await ensureDeviceId()) ?? '';
});

beforeEach(() => {
  memoryKeychain.reset();
  memoryKeychain.hold(EMAIL, 'dc1:secret');
  useStore.setState({
    user: { id: 'u1', email: EMAIL, emailVerified: true, onBoarded: true },
    isOnline: true,
    apiReachable: true,
    biometricRetryAt: 0,
  });
});

describe('every identity surface presents one value', () => {
  it('the header reads the id the device holds', () => {
    expect(thisDevice).not.toBe('');
    expect(getDeviceId()).toBe(thisDevice);
  });

  it('issuing a device credential binds it to the same device', async () => {
    const issue = recordMock(IssueDeviceCredentialDocument, {
      data: {
        issueDeviceCredential: {
          __typename: 'DeviceCredentialPayload',
          credential: 'issued',
        },
      },
    });
    registerTestClient([issue]);

    await biometricService.enrolDeviceCredential(EMAIL);

    expect(issue.fired).toEqual([{ input: { deviceId: thisDevice } }]);
  });

  it('exchanging a device credential presents the same device', async () => {
    const exchange = recordMock(ExchangeDeviceCredentialDocument, {
      data: {
        exchangeDeviceCredential: {
          __typename: 'AuthenticationError',
          code: ErrorCode.AuthCredentialsInvalid,
          disposition: ErrorDisposition.Fail,
          message: 'Refused',
        },
      },
    });
    registerTestClient([exchange]);

    await biometricService.signInWithDeviceCredential(EMAIL);

    expect(exchange.fired).toEqual([
      { input: { credential: 'secret', deviceId: thisDevice } },
    ]);
  });

  it('revoking finds this device by the same value', async () => {
    const revoke = recordMock(RevokeDeviceCredentialDocument, {
      data: {
        revokeDeviceCredential: {
          __typename: 'RevokeDeviceCredentialPayload',
        },
      },
    });
    registerTestClient([
      recordMock(MyDeviceCredentialsDocument, {
        data: {
          deviceCredentials: [
            {
              __typename: 'DeviceCredential',
              id: 'other',
              deviceId: 'device_someone_else',
            },
            {
              __typename: 'DeviceCredential',
              id: 'mine',
              deviceId: thisDevice,
            },
          ],
        },
      }),
      revoke,
    ]);

    await biometricService.revokeDeviceCredentialForThisDevice();

    expect(revoke.fired).toEqual([{ input: { id: 'mine' } }]);
  });
});

describe('the sign-in input carries no device field', () => {
  it('travels in the header only', () => {
    expect(print(LoginDocument)).not.toMatch(/deviceId/);
  });
});
