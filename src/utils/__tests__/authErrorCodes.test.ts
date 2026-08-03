import {
  isDeadCredentialCode,
  isSessionEndingAuthCode,
} from '../authErrorCodes';

// The credentials themselves are gone — both predicates must agree.
const DEAD_CREDENTIALS = ['AUTH_CREDENTIALS_INVALID', 'AUTH_ACCOUNT_SUSPENDED'];

// The session can't be revived, but the stored email/password are still good.
const TOKEN_ONLY = [
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_MISSING',
];

describe('isDeadCredentialCode', () => {
  it.each(DEAD_CREDENTIALS)('drops stored credentials on %s', code => {
    expect(isDeadCredentialCode(code)).toBe(true);
  });

  // The distinction the whole module exists for: a dead session must not cost
  // the user a full biometric re-enrollment when the password still works.
  it.each(TOKEN_ONLY)('keeps stored credentials on %s', code => {
    expect(isDeadCredentialCode(code)).toBe(false);
  });
});

describe('isSessionEndingAuthCode', () => {
  it.each([...DEAD_CREDENTIALS, ...TOKEN_ONLY])(
    'ends the session on %s',
    code => {
      expect(isSessionEndingAuthCode(code)).toBe(true);
    },
  );

  // AUTH_ACCOUNT_LOCKED is a temporary, self-clearing failed-attempt lockout.
  // Signing the user out (or dropping their credentials) over a window that
  // expires on its own is the regression this guards against.
  it('defers on the temporary lockout rather than ending the session', () => {
    expect(isSessionEndingAuthCode('AUTH_ACCOUNT_LOCKED')).toBe(false);
    expect(isDeadCredentialCode('AUTH_ACCOUNT_LOCKED')).toBe(false);
  });

  it.each(['VALIDATION_FAILED', 'CONFLICT', 'NOT_FOUND', 'AUTH_TOKEN_INVALID'])(
    'leaves the session alone on %s',
    code => {
      expect(isSessionEndingAuthCode(code)).toBe(false);
    },
  );
});
