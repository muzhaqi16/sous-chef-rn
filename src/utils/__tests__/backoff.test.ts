import { backoffDelay, retryCooldownMs, sleep } from '../backoff';

describe('backoffDelay', () => {
  it('starts at the base on attempt 0', () => {
    expect(backoffDelay(0, { baseMs: 1000 })).toBe(1000);
  });

  it('doubles each attempt by default', () => {
    expect([0, 1, 2, 3].map(n => backoffDelay(n, { baseMs: 1000 }))).toEqual([
      1000, 2000, 4000, 8000,
    ]);
  });

  it('grows by the factor given', () => {
    expect(backoffDelay(2, { baseMs: 100, factor: 3 })).toBe(900);
  });

  it('holds at the cap', () => {
    const schedule = { baseMs: 1000, maxMs: 30_000 };
    expect(backoffDelay(4, schedule)).toBe(16_000);
    expect(backoffDelay(5, schedule)).toBe(30_000);
    expect(backoffDelay(40, schedule)).toBe(30_000);
  });

  it('never draws a random number without jitter', () => {
    const random = jest.fn(() => 0.5);
    expect(backoffDelay(1, { baseMs: 1000, random })).toBe(2000);
    expect(random).not.toHaveBeenCalled();
  });

  it('adds up to the jitter fraction of the delay', () => {
    const schedule = { baseMs: 1000, jitter: 0.25 };
    expect(backoffDelay(1, { ...schedule, random: () => 0 })).toBe(2000);
    expect(backoffDelay(1, { ...schedule, random: () => 0.5 })).toBe(2250);
    expect(backoffDelay(1, { ...schedule, random: () => 0.999 })).toBeLessThan(
      2500,
    );
  });

  it('jitters on top of the cap, so delays past it still spread', () => {
    const schedule = { baseMs: 1000, maxMs: 30_000, jitter: 0.25 };
    expect(backoffDelay(10, { ...schedule, random: () => 0 })).toBe(30_000);
    expect(backoffDelay(10, { ...schedule, random: () => 0.5 })).toBe(33_750);
  });
});

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves once the time has passed', async () => {
    const settled = jest.fn();
    void sleep(1000).then(settled);

    await jest.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalled();
  });
});

describe('retryCooldownMs', () => {
  it('holds nothing before the first try', () => {
    expect(retryCooldownMs(0)).toBe(0);
  });

  it('steps up with each try, then holds at five minutes', () => {
    expect([1, 2, 3, 4, 5, 50].map(retryCooldownMs)).toEqual([
      30_000, 60_000, 180_000, 300_000, 300_000, 300_000,
    ]);
  });

  it('reads a negative count as none', () => {
    expect(retryCooldownMs(-1)).toBe(0);
  });
});
