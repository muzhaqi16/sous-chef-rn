import { scrubString, scrubLogExtra } from '../scrub';

describe('scrubString', () => {
  it('redacts email addresses', () => {
    expect(scrubString('user jane@example.com signed in')).toBe(
      'user [REDACTED] signed in',
    );
  });

  it('redacts long opaque tokens (JWT/API keys)', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc';
    expect(scrubString(`token=${jwt}`)).toBe('token=[REDACTED]');
  });

  it('truncates very long strings', () => {
    const long = 'word '.repeat(500); // 2500 chars, no single long token
    const out = scrubString(long);
    expect(out.endsWith('…[truncated]')).toBe(true);
    expect(out.length).toBeLessThan(long.length);
  });

  it('leaves ordinary text untouched', () => {
    expect(scrubString('quantity updated to 5')).toBe('quantity updated to 5');
  });
});

describe('scrubLogExtra', () => {
  it('returns an empty object for undefined', () => {
    expect(scrubLogExtra(undefined)).toEqual({});
  });

  it('redacts values under sensitive keys', () => {
    expect(
      scrubLogExtra({ password: 'hunter2', authToken: 'x', email: 'a@b.co' }),
    ).toEqual({
      password: '[REDACTED]',
      authToken: '[REDACTED]',
      email: '[REDACTED]',
    });
  });

  it('does not over-redact lookalike keys such as "author"', () => {
    expect(scrubLogExtra({ author: 'Jane Doe' })).toEqual({
      author: 'Jane Doe',
    });
  });

  it('recurses into nested objects and arrays', () => {
    expect(
      scrubLogExtra({
        context: { secret: 's', items: ['ok', 'reach me at x@y.com'] },
      }),
    ).toEqual({
      context: {
        secret: '[REDACTED]',
        items: ['ok', 'reach me at [REDACTED]'],
      },
    });
  });

  it('preserves non-string primitives', () => {
    expect(scrubLogExtra({ count: 3, ok: true, missing: null })).toEqual({
      count: 3,
      ok: true,
      missing: null,
    });
  });

  it('bounds recursion depth', () => {
    const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };
    const out = scrubLogExtra(deep) as {
      a: { b: { c: { d: unknown } } };
    };
    expect(out.a.b.c.d).toBe('[Object]');
  });
});
