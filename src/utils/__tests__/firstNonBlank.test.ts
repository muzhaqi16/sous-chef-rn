import { firstNonBlank } from '../firstNonBlank';

describe('firstNonBlank', () => {
  it('returns the first value with visible text', () => {
    expect(firstNonBlank('Sam', 'sam@example.com')).toBe('Sam');
  });

  it('skips empty and whitespace-only strings, which ?? would keep', () => {
    expect(firstNonBlank('', '   ', 'sam@example.com')).toBe('sam@example.com');
  });

  it('skips null and undefined', () => {
    expect(firstNonBlank(null, undefined, 'Someone')).toBe('Someone');
  });

  it('returns undefined when nothing has text, so the caller supplies copy', () => {
    expect(firstNonBlank('', null, undefined)).toBeUndefined();
  });

  it('returns the value as given, without trimming it', () => {
    expect(firstNonBlank(' Sam ')).toBe(' Sam ');
  });
});
