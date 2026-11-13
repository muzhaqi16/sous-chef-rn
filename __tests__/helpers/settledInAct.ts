import { act } from '@testing-library/react-native';

/**
 * Runs `work` inside `act` and hands back its result once it has settled, with
 * what it started rendered. On a real clock its answers arrive by themselves.
 */
export async function settledInAct<T>(work: () => Promise<T> | T): Promise<T> {
  const box: { result?: { value: T } } = {};
  await act(async () => {
    box.result = { value: await work() };
  });
  if (!box.result) throw new Error('the work never settled');
  return box.result.value;
}
