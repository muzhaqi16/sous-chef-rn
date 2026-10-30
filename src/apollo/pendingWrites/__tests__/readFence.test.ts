import { ReadFence } from '../readFence';

const settled = async (promise: Promise<void>) => {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  await new Promise(resolve => setImmediate(resolve));
  return done;
};

describe('ReadFence', () => {
  it('passes once the last read in flight has landed', async () => {
    const fence = new ReadFence();
    const first = fence.begin();
    const second = fence.begin();
    const passed = fence.passed();

    first();
    expect(await settled(passed)).toBe(false);

    second();
    expect(await settled(passed)).toBe(true);
    expect(fence.isClear).toBe(true);
  });

  it('ignores a read sent after the call', async () => {
    const fence = new ReadFence();
    const before = fence.begin();
    const passed = fence.passed();
    fence.begin();

    before();

    expect(await settled(passed)).toBe(true);
  });

  it('stops waiting for a read that hangs', async () => {
    jest.useFakeTimers();
    const fence = new ReadFence();
    fence.begin();
    const passed = fence.passed();

    jest.advanceTimersByTime(30_000);

    await expect(passed).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
