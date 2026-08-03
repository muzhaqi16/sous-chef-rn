import {
  isDeadCredentialCode,
  isSessionEndingAuthCode,
  isRefreshableAuthCode,
  isDeadRefreshTokenCode,
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
