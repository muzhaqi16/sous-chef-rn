import { requireApolloClient } from '#/apollo/clientRegistry';
import {
  readReplayWindow,
  replayWindowMs,
  resetReplayWindow,
} from '../replayWindow';

jest.mock('#/apollo/clientRegistry', () => ({
  requireApolloClient: jest.fn(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const query = jest.fn();

beforeEach(() => {
  resetReplayWindow();
  query.mockReset();
  jest.mocked(requireApolloClient).mockReturnValue({ query } as never);
});

const answers = (replayWindowDays: number) =>
  query.mockResolvedValue({ data: { offlineLimits: { replayWindowDays } } });

describe('the replay window', () => {
  it('follows a shorter window the server states', async () => {
    answers(45);

    await readReplayWindow();

    expect(replayWindowMs()).toBe(45 * DAY_MS);
  });

  it('never outlives what this build allows, however long the server states', async () => {
    answers(365);

    await readReplayWindow();

    expect(replayWindowMs()).toBe(90 * DAY_MS);
  });

  it('keeps the limit and asks again when the read is not answered', async () => {
    query.mockRejectedValue(new Error('offline'));

    await readReplayWindow();

    expect(replayWindowMs()).toBe(90 * DAY_MS);

    answers(45);
    await readReplayWindow();

    expect(replayWindowMs()).toBe(45 * DAY_MS);
  });

  it('asks once an answer has come', async () => {
    answers(90);

    await readReplayWindow();
    await readReplayWindow();

    expect(query).toHaveBeenCalledTimes(1);
  });
});
