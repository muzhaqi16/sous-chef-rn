import { errorService } from '#/services/errorService';
import { uploadTogether } from '../uploadTogether';

jest.mock('#/services/errorService');

const options = { limitMs: 1000, operation: 'Upload test photo' };

describe('uploadTogether', () => {
  beforeEach(() => jest.clearAllMocks());

  it('answers every key when each one goes up', async () => {
    const keys = await uploadTogether(
      ['a', 'b'],
      file => Promise.resolve(`key-${file}`),
      options,
    );

    expect(keys).toEqual(['key-a', 'key-b']);
  });

  it('stops the rest at the first failure, and reports only that one', async () => {
    const stopped: boolean[] = [];
    const keys = await uploadTogether(
      ['fails', 'waits'],
      (file, signal) =>
        file === 'fails'
          ? Promise.reject(new Error('upload refused'))
          : new Promise((_, reject) =>
              signal.addEventListener('abort', () => {
                stopped.push(true);
                reject(new Error('aborted'));
              }),
            ),
      options,
    );

    expect(keys).toBeNull();
    expect(stopped).toEqual([true]);
    expect(errorService.reportError).toHaveBeenCalledTimes(1);
  });

  it('gives up at the time limit and says so', async () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const pending = uploadTogether(
      ['slow'],
      (_, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
      { ...options, onTimeout },
    );

    jest.advanceTimersByTime(1000);

    expect(await pending).toBeNull();
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(errorService.reportError).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
