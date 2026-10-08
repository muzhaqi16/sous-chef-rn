import {
  emailRule,
  lazyMessage,
  nameRule,
  optionalMoneyRule,
  parseMoneyInput,
  passwordRule,
  positiveDecimalRule,
  quantityRule,
} from '../common';

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

  // The API's EmailAddress scalar refuses these before any resolver runs.
  it.each([
    'user@gmailcom',
    'a@b.c',
    'a..b@example.com',
    'a!b@example.com',
    `${'a'.repeat(250)}@example.com`,
  ])('rejects %p, which the API refuses', async email => {
    await expect(emailRule.validate(email)).rejects.toThrow('valid email');
  });

  it.each(["o'neil@example.com", 'first.last+tag@mail.example.co'])(
    'accepts %p',
    async email => {
      await expect(emailRule.validate(email)).resolves.toBe(email);
    },
  );
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

describe('lazyMessage', () => {
  it('resolves its key when the rule reports, not when it is built', () => {
    const message = lazyMessage('errors.invalidQuantity');
    expect(message()).toBe('Please enter a valid quantity');
  });
});

describe('quantityRule', () => {
  const rule = quantityRule('errors.invalidQuantity');

  it.each(['2', '0.5', '1 1/4'])('accepts %p', async value => {
    await expect(rule.validate(value)).resolves.toBe(value);
  });

  it.each(['0', '-1', 'abc', '', '  '])('refuses %p', async value => {
    await expect(rule.validate(value)).rejects.toThrow(
      'Please enter a valid quantity',
    );
  });

  it('takes zero only where it is allowed', async () => {
    const withZero = quantityRule('errors.invalidQuantity', {
      allowZero: true,
    });
    await expect(withZero.validate('0')).resolves.toBe('0');
    await expect(withZero.validate('-1')).rejects.toThrow();
  });
});

describe('positiveDecimalRule', () => {
  const rule = positiveDecimalRule('errors.invalidQuantity');

  it('accepts a decimal above zero', async () => {
    await expect(rule.validate('1.5')).resolves.toBe('1.5');
  });

  // A fraction is refused rather than guessed at: `1 1/2` minus its space reads
  // as 11/2.
  it.each(['0', '-2', 'abc', '1 1/2', ''])('refuses %p', async value => {
    await expect(rule.validate(value)).rejects.toThrow(
      'Please enter a valid quantity',
    );
  });

  it('leaves an optional one blank', async () => {
    const optional = positiveDecimalRule('errors.invalidQuantity', {
      optional: true,
    });
    await expect(optional.validate(' ')).resolves.toBe(' ');
    await expect(optional.validate('0')).rejects.toThrow();
  });
});

describe('parseMoneyInput', () => {
  it.each(['', '  '])('reads %p as unstated', value => {
    expect(parseMoneyInput(value)).toBeNull();
  });

  it.each([
    ['3.49', 3.49],
    ['4,99', 4.99],
    ['0', 0],
    [' 12 ', 12],
  ])('reads %p as %p', (value, amount) => {
    expect(parseMoneyInput(value)).toBe(amount);
  });

  // `parseFloat` reads a leading number and drops the rest.
  it.each(['-3', '4,99x', 'abc', '$3', '.', '1/2'])(
    'reads %p as unusable',
    value => {
      expect(parseMoneyInput(value)).toBeUndefined();
    },
  );
});

describe('optionalMoneyRule', () => {
  const rule = optionalMoneyRule('errors.invalidAmountPaid');

  it.each(['', '3.49', '0'])('accepts %p', async value => {
    await expect(rule.validate(value)).resolves.toBe(value);
  });

  it.each(['-3', '4,99x'])('refuses %p', async value => {
    await expect(rule.validate(value)).rejects.toThrow(
      'Enter the amount paid, like 3.49, or leave it empty.',
    );
  });
});
