import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  getEmailVerificationValidationSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../auth';
import { changeLanguage } from '#/i18n/config';

describe('loginSchema', () => {
  it('validates a correct login', async () => {
    await expect(
      loginSchema.validate({ email: 'user@example.com', password: 'Pass1234' }),
    ).resolves.toBeTruthy();
  });

  it('rejects empty email', async () => {
    await expect(
      loginSchema.validate({ email: '', password: 'Pass1234' }),
    ).rejects.toThrow();
  });

  it('rejects invalid email', async () => {
    await expect(
      loginSchema.validate({ email: 'notanemail', password: 'Pass1234' }),
    ).rejects.toThrow('valid email');
  });

  it('rejects empty password', async () => {
    await expect(
      loginSchema.validate({ email: 'u@e.com', password: '' }),
    ).rejects.toThrow('required');
  });
});

describe('signUpSchema', () => {
  const valid = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
  };

  it('validates correct sign-up', async () => {
    await expect(signUpSchema.validate(valid)).resolves.toBeTruthy();
  });

  it('rejects missing name', async () => {
    await expect(
      signUpSchema.validate({ ...valid, name: '' }),
    ).rejects.toThrow();
  });

  it('rejects name shorter than 2 chars', async () => {
    await expect(
      signUpSchema.validate({ ...valid, name: 'J' }),
    ).rejects.toThrow('2 characters');
  });

  it('rejects mismatched passwords', async () => {
    await expect(
      signUpSchema.validate({ ...valid, confirmPassword: 'Different1' }),
    ).rejects.toThrow('must match');
  });
});

describe('forgotPasswordSchema', () => {
  it('validates correct email', async () => {
    await expect(
      forgotPasswordSchema.validate({ email: 'user@e.com' }),
    ).resolves.toBeTruthy();
  });

  // Format cases belong here, not in the Detox suite: each e2e submit spends
  // one of `requestPasswordReset`'s five-per-hour budget, and the thing under
  // test is the client rule, which never reaches the server.
  it('accepts a plus-addressed email', async () => {
    await expect(
      forgotPasswordSchema.validate({ email: 'user+test@example.com' }),
    ).resolves.toBeTruthy();
  });

  it('accepts a long local part and domain', async () => {
    const longEmail = `${'a'.repeat(50)}@${'b'.repeat(50)}.com`;
    await expect(
      forgotPasswordSchema.validate({ email: longEmail }),
    ).resolves.toBeTruthy();
  });

  it('rejects empty email', async () => {
    await expect(
      forgotPasswordSchema.validate({ email: '' }),
    ).rejects.toThrow();
  });
});

describe('getEmailVerificationValidationSchema', () => {
  // No translate function is threaded in; the schema resolves its messages
  // lazily from the active locale (English in tests).
  const emailVerificationSchema = getEmailVerificationValidationSchema();

  it('validates 6-digit code', async () => {
    await expect(
      emailVerificationSchema.validate({ code: '123456' }),
    ).resolves.toBeTruthy();
  });

  it('rejects non-6-digit code', async () => {
    await expect(
      emailVerificationSchema.validate({ code: '12345' }),
    ).rejects.toThrow('6 digits');
  });

  it('rejects non-numeric code', async () => {
    await expect(
      emailVerificationSchema.validate({ code: 'abcdef' }),
    ).rejects.toThrow('6 digits');
  });

  it('rejects empty code', async () => {
    await expect(
      emailVerificationSchema.validate({ code: '' }),
    ).rejects.toThrow('code is required');
  });
});

describe('resetPasswordSchema', () => {
  it('validates matching passwords', async () => {
    await expect(
      resetPasswordSchema.validate({
        newPassword: 'NewPass1',
        confirmPassword: 'NewPass1',
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects mismatched passwords', async () => {
    await expect(
      resetPasswordSchema.validate({
        newPassword: 'NewPass1',
        confirmPassword: 'OtherPass1',
      }),
    ).rejects.toThrow('must match');
  });
});

/**
 * The server refuses anything outside 8-72 characters with a lowercase letter,
 * an uppercase letter and a digit. Checking it here is what keeps a doomed
 * round trip — and the rate budget it spends — off the sign-up path.
 */
describe('the password policy for a password being SET', () => {
  const LEGACY = 'abcdefg1'; // no uppercase: the server refuses it
  const TOO_LONG = `Aa1${'x'.repeat(70)}`; // 73 characters

  const setters = [
    {
      name: 'signUpSchema',
      validate: (password: string) =>
        signUpSchema.validate({
          name: 'John Doe',
          email: 'john@example.com',
          password,
          confirmPassword: password,
        }),
    },
    {
      name: 'resetPasswordSchema',
      validate: (password: string) =>
        resetPasswordSchema.validate({
          newPassword: password,
          confirmPassword: password,
        }),
    },
    {
      name: 'changePasswordSchema',
      validate: (password: string) =>
        changePasswordSchema.validate({
          currentPassword: 'OldPass1',
          newPassword: password,
          confirmPassword: password,
        }),
    },
  ];

  it.each(setters)(
    '$name rejects a password with no uppercase',
    async ({ validate }) => {
      await expect(validate(LEGACY)).rejects.toThrow('uppercase');
    },
  );

  it.each(setters)(
    '$name rejects a password with no lowercase',
    async ({ validate }) => {
      await expect(validate('ABCDEFG1')).rejects.toThrow('lowercase');
    },
  );

  it.each(setters)(
    '$name rejects a password with no digit',
    async ({ validate }) => {
      await expect(validate('Abcdefgh')).rejects.toThrow('number');
    },
  );

  it.each(setters)(
    '$name rejects a password over 72 characters',
    async ({ validate }) => {
      await expect(validate(TOO_LONG)).rejects.toThrow('72 characters');
    },
  );

  it.each(setters)(
    '$name accepts a policy-compliant password',
    async ({ validate }) => {
      await expect(validate('NewPass1')).resolves.toBeTruthy();
    },
  );

  // Sign-in reads back a password the account already has, so any POLICY rule
  // the client adds here refuses a real password with no way in — the reset
  // flow needs the account it cannot reach. The 72 cap is the one exception,
  // covered below: bcrypt's limit, which the server enforces on login too.
  it.each([LEGACY, 'short', 'ALLCAPS', '12345678'])(
    'loginSchema accepts %p, which the SET policy refuses',
    async password => {
      await expect(
        loginSchema.validate({ email: 'u@e.com', password }),
      ).resolves.toBeTruthy();
    },
  );

  it('loginSchema still rejects an empty password', async () => {
    await expect(
      loginSchema.validate({ email: 'u@e.com', password: '' }),
    ).rejects.toThrow('required');
  });

  // The one bound sign-in shares with the SET policy. Verified against the dev
  // API: a 75-character password answers `VALIDATION_FAILED` on `password`
  // ("password must be at most 72 characters"), so accepting it here only buys
  // a doomed round trip.
  it('loginSchema rejects a password over 72 characters', async () => {
    await expect(
      loginSchema.validate({ email: 'u@e.com', password: TOO_LONG }),
    ).rejects.toThrow('72 characters');
  });
});

describe('changePasswordSchema', () => {
  const valid = {
    currentPassword: 'OldPass1',
    newPassword: 'NewPass2',
    confirmPassword: 'NewPass2',
  };

  it('validates correct change', async () => {
    await expect(changePasswordSchema.validate(valid)).resolves.toBeTruthy();
  });

  it('rejects same old and new password', async () => {
    await expect(
      changePasswordSchema.validate({
        ...valid,
        newPassword: 'OldPass1',
        confirmPassword: 'OldPass1',
      }),
    ).rejects.toThrow('different');
  });

  it('rejects missing current password', async () => {
    await expect(
      changePasswordSchema.validate({ ...valid, currentPassword: '' }),
    ).rejects.toThrow();
  });
});

describe('lazy localization across language switches', () => {
  afterEach(async () => {
    await changeLanguage('en');
  });

  it('resolves a schema message in the language active at validation time', async () => {
    // The schemas are built once at module import (English active). The lazy
    // msg() lookup must reflect a later language switch, not the import-time
    // language.
    await changeLanguage('es');
    await expect(
      signUpSchema.validate({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Pass1234',
        confirmPassword: 'Different1',
      }),
    ).rejects.toThrow('deben coincidir');
  });

  it('resolves a shared common rule message in the active language', async () => {
    await changeLanguage('it');
    await expect(
      loginSchema.validate({ email: 'notanemail', password: 'Pass1234' }),
    ).rejects.toThrow('indirizzo email valido');
  });
});
