import {
  CREDENTIAL_KEPT_ON_CODES,
  DEAD_ACCOUNT_CREDENTIAL_CODES,
  isDeadCredentialCode,
  isSessionEndingAuthCode,
  isRefreshableAuthCode,
  isDeadRefreshTokenCode,
  isSupersededRefreshCode,
  isAuthRefusalCode,
} from '../authErrorCodes';

// The account credentials are gone, so the session ends.
const DEAD_CREDENTIALS = ['AUTH_CREDENTIALS_INVALID', 'AUTH_ACCOUNT_SUSPENDED'];

// The stored biometric secret is dead — a narrower set than DEAD_CREDENTIALS.
const DEAD_SLOT = ['AUTH_ACCOUNT_SUSPENDED', 'AUTH_DEVICE_CREDENTIAL_INVALID'];

// The session can't be revived, but the stored email/password are still good.
const TOKEN_ONLY = [
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_MISSING',
];

describe('isDeadCredentialCode', () => {
  it.each(DEAD_SLOT)('drops stored credentials on %s', code => {
    expect(isDeadCredentialCode(code)).toBe(true);
  });

  // The distinction the whole module exists for: a dead session must not cost
  // the user a full biometric re-enrollment when the password still works.
  it.each(TOKEN_ONLY)('keeps stored credentials on %s', code => {
    expect(isDeadCredentialCode(code)).toBe(false);
  });

  // `exchangeDeviceCredential` names AUTH_DEVICE_CREDENTIAL_INVALID as its one
  // clear-the-slot signal, so this code cannot mean the stored secret is dead.
  it('ends the session on AUTH_CREDENTIALS_INVALID without dropping the slot', () => {
    expect(isSessionEndingAuthCode('AUTH_CREDENTIALS_INVALID')).toBe(true);
    expect(isDeadCredentialCode('AUTH_CREDENTIALS_INVALID')).toBe(false);
  });

  it.each(['OPERATION_RATE_LIMITED', 'RATE_LIMIT_EXCEEDED'])(
    'keeps stored credentials on %s',
    code => {
      expect(isDeadCredentialCode(code)).toBe(false);
    },
  );
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

  // AUTH_EMAIL_NOT_VERIFIED is now a union-member code as well as a top-level
  // one, so it reaches these predicates from both channels. It is a 403 that
  // leaves the credential VALID — the emailed code clears it — and signing the
  // user out over an unproven mailbox destroys a working session for nothing.
  it('keeps the session on an unverified mailbox', () => {
    expect(isSessionEndingAuthCode('AUTH_EMAIL_NOT_VERIFIED')).toBe(false);
    expect(isDeadCredentialCode('AUTH_EMAIL_NOT_VERIFIED')).toBe(false);
  });

  it.each(['VALIDATION_FAILED', 'CONFLICT', 'NOT_FOUND', 'AUTH_TOKEN_INVALID'])(
    'leaves the session alone on %s',
    code => {
      expect(isSessionEndingAuthCode(code)).toBe(false);
    },
  );
});

// The one auth refusal that is neither refreshable nor fatal. Another request
// rotated the token first; the session the winner renewed is perfectly alive,
// and signing the user out of it is the regression this guards.
describe('isSupersededRefreshCode', () => {
  const SUPERSEDED = 'AUTH_REFRESH_TOKEN_SUPERSEDED';

  it('recognizes the lost-race refusal', () => {
    expect(isSupersededRefreshCode(SUPERSEDED)).toBe(true);
  });

  it('never ends the session', () => {
    expect(isSessionEndingAuthCode(SUPERSEDED)).toBe(false);
    expect(isDeadCredentialCode(SUPERSEDED)).toBe(false);
  });

  // isDeadRefreshTokenCode is what makes errorLink end the session on sight,
  // without even attempting a refresh.
  it('is not a dead refresh token', () => {
    expect(isDeadRefreshTokenCode(SUPERSEDED)).toBe(false);
  });

  // The refresh that clears it presents a DIFFERENT token, so this is not the
  // question the top-level refreshable branch asks.
  it('is not the refreshable-on-an-ordinary-operation answer', () => {
    expect(isRefreshableAuthCode(SUPERSEDED)).toBe(false);
  });

  // The offline queue asks only "is this the auth pipeline's problem" — it is.
  it('still counts as an auth refusal for the offline queue', () => {
    expect(isAuthRefusalCode(SUPERSEDED)).toBe(true);
  });

  it.each(['AUTH_REFRESH_TOKEN_INVALID', 'AUTH_TOKEN_EXPIRED'])(
    'does not claim %s',
    code => {
      expect(isSupersededRefreshCode(code)).toBe(false);
    },
  );
});

// Access-token-side refusals on an ordinary operation. AUTH_TOKEN_INVALID is
// the one the old message heuristics missed outright: "token is malformed or
// invalid" contains none of the terms they matched, so it never earned the
// refresh that would have fixed it.
const REFRESHABLE = [
  'UNAUTHENTICATED',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
];

describe('isRefreshableAuthCode', () => {
  it.each(REFRESHABLE)('exchanges the refresh token on %s', code => {
    expect(isRefreshableAuthCode(code)).toBe(true);
  });

  // The same code answers this question and isSessionEndingAuthCode in
  // opposite directions, because the channels mean different things: on the
  // refresh mutation's own response the exchange has already failed, while on
  // an ordinary operation it hasn't been tried yet.
  it.each(['AUTH_TOKEN_EXPIRED', 'AUTH_TOKEN_MISSING'])(
    'deliberately disagrees with isSessionEndingAuthCode on %s',
    code => {
      expect(isRefreshableAuthCode(code)).toBe(true);
      expect(isSessionEndingAuthCode(code)).toBe(true);
    },
  );

  // Refreshing cannot fix any of these: a dead refresh token has nothing left
  // to exchange, a permission denial isn't about the token at all, and the
  // verification gate lifts on the next request without one.
  it.each([
    'AUTH_REFRESH_TOKEN_INVALID',
    'AUTH_REFRESH_TOKEN_MISSING',
    'AUTH_CREDENTIALS_INVALID',
    'AUTH_ACCOUNT_LOCKED',
    'AUTH_ACCOUNT_SUSPENDED',
    'AUTH_EMAIL_NOT_VERIFIED',
    'FORBIDDEN',
    'API_KEY_INSUFFICIENT_PERMISSIONS',
    'VALIDATION_FAILED',
  ])('does not spend a refresh on %s', code => {
    expect(isRefreshableAuthCode(code)).toBe(false);
  });

  // The predicate is code-only. An error carrying no code must never trigger a
  // refresh on the strength of its prose.
  it('ignores the message entirely', () => {
    expect(isRefreshableAuthCode('')).toBe(false);
  });
});

describe('isDeadRefreshTokenCode', () => {
  it.each(['AUTH_REFRESH_TOKEN_INVALID', 'AUTH_REFRESH_TOKEN_MISSING'])(
    'ends the session on %s',
    code => {
      expect(isDeadRefreshTokenCode(code)).toBe(true);
    },
  );

  // These end the session too, but via their own branches — the account-state
  // one, or a refresh that comes back empty. Keeping them out here preserves
  // the distinct logging and the one refresh attempt.
  it.each(['AUTH_TOKEN_EXPIRED', 'AUTH_ACCOUNT_SUSPENDED', 'UNAUTHENTICATED'])(
    'leaves %s to its own branch',
    code => {
      expect(isDeadRefreshTokenCode(code)).toBe(false);
    },
  );

  // The two predicates errorLink consults must never both fire on one code, or
  // the branch order silently decides between ending the session and retrying.
  it('never overlaps with isRefreshableAuthCode', () => {
    const overlap = REFRESHABLE.filter(isDeadRefreshTokenCode);
    expect(overlap).toEqual([]);
  });
});

// The two lists were independent literals, so a code added to the account list
// reached `isSessionEndingAuthCode` and not `isDeadCredentialCode` — the session
// ended while the biometric slot stayed, offering a sign-in against an account
// that is gone.
describe('the dead-credential list derives from the dead-account list', () => {
  it.each(DEAD_ACCOUNT_CREDENTIAL_CODES)(
    'agrees with the account list on %s unless it is deliberately kept',
    code => {
      expect(isDeadCredentialCode(code)).toBe(
        !CREDENTIAL_KEPT_ON_CODES.includes(code),
      );
    },
  );

  it('ends the session on every code in the account list', () => {
    for (const code of DEAD_ACCOUNT_CREDENTIAL_CODES) {
      expect(isSessionEndingAuthCode(code)).toBe(true);
    }
  });

  it('subtracts only the login rejection', () => {
    expect(CREDENTIAL_KEPT_ON_CODES).toEqual(['AUTH_CREDENTIALS_INVALID']);
  });
});
