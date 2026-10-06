import { withinMs } from '../withinMs';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const never = () => new Promise<string>(() => {});

describe('withinMs', () => {
  it("answers with the promise's value when it settles first", async () => {
    await expect(withinMs(Promise.resolve('token'), 1_000, null)).resolves.toBe(
      'token',
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('answers with the fallback once the time runs out', async () => {
    const answer = withinMs(never(), 1_000, null);

    await jest.advanceTimersByTimeAsync(1_000);

    await expect(answer).resolves.toBeNull();
  });

  it('rejects as the promise does, and clears its timer', async () => {
    const answer = withinMs(Promise.reject(new Error('refused')), 1_000, null);

    await expect(answer).rejects.toThrow('refused');
    expect(jest.getTimerCount()).toBe(0);
  });
});
