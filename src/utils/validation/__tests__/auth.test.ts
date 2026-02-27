import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  emailVerificationSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../auth';

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

  it('rejects empty email', async () => {
    await expect(
      forgotPasswordSchema.validate({ email: '' }),
    ).rejects.toThrow();
  });
});

describe('emailVerificationSchema', () => {
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
    ).rejects.toThrow();
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
