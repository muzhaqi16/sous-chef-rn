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

  it('rejects short password', async () => {
    await expect(
      loginSchema.validate({ email: 'u@e.com', password: 'Ab1' }),
    ).rejects.toThrow('8 characters');
  });

  it('rejects password without number', async () => {
    await expect(
      loginSchema.validate({ email: 'u@e.com', password: 'Abcdefgh' }),
    ).rejects.toThrow('number');
  });

  it('rejects password without letter', async () => {
    await expect(
      loginSchema.validate({ email: 'u@e.com', password: '12345678' }),
    ).rejects.toThrow('letter');
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
        password: 'NewPass1',
        confirmPassword: 'NewPass1',
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects mismatched passwords', async () => {
    await expect(
      resetPasswordSchema.validate({
        password: 'NewPass1',
        confirmPassword: 'OtherPass1',
      }),
    ).rejects.toThrow('must match');
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
