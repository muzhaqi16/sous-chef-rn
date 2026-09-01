import { emailRule, passwordRule, nameRule } from '../common';

describe('emailRule', () => {
  it('accepts valid email', async () => {
    await expect(emailRule.validate('user@example.com')).resolves.toBe(
      'user@example.com',
    );
  });

  it('rejects empty string', async () => {
    await expect(emailRule.validate('')).rejects.toThrow('required');
  });

  it('rejects invalid email format', async () => {
    await expect(emailRule.validate('notanemail')).rejects.toThrow(
      'valid email',
    );
  });
});

// Sign-in only asserts the field is filled: the server checks non-emptiness and
// nothing more, so every rule below it would refuse a password an account has.
describe('passwordRule', () => {
  it('accepts valid password', async () => {
    await expect(passwordRule.validate('MyPass12')).resolves.toBe('MyPass12');
  });

  it('rejects empty', async () => {
    await expect(passwordRule.validate('')).rejects.toThrow('required');
  });

  it.each(['Ab1', '12345678', 'Abcdefgh', 'a'])(
    'accepts %p, which the SET policy would refuse',
    async password => {
      await expect(passwordRule.validate(password)).resolves.toBe(password);
    },
  );
});

describe('nameRule', () => {
  it('accepts valid name', async () => {
    await expect(nameRule.validate('John')).resolves.toBe('John');
  });

  it('accepts hyphens and apostrophes', async () => {
    await expect(nameRule.validate("O'Brien-Smith")).resolves.toBeTruthy();
  });

  it('rejects < 2 chars', async () => {
    await expect(nameRule.validate('J')).rejects.toThrow('2 characters');
  });

  it('rejects > 50 chars', async () => {
    await expect(nameRule.validate('A'.repeat(51))).rejects.toThrow(
      '50 characters',
    );
  });

  it('rejects numbers in name', async () => {
    await expect(nameRule.validate('John123')).rejects.toThrow();
  });
});
