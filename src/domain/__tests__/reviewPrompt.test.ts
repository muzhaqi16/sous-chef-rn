import { requirePlatform } from '#platform/install';
import { useStore } from '#store';
import { useReviewPromptStore } from '#store/reviewPromptStore';
import {
  askForReviewAfterSuccess,
  DAYS_BETWEEN_REQUESTS,
  isDueForReview,
} from '#/domain/reviewPrompt';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 28, 12);
const THREE_DAYS = ['2026-10-20', '2026-10-24', '2026-10-28'];

const pacing = (over: Partial<Parameters<typeof isDueForReview>[0]> = {}) => ({
  activeDays: THREE_DAYS,
  lastRequestedAt: null,
  lastRequestedVersion: null,
  ...over,
});

describe('isDueForReview', () => {
  const at = { now: NOW, version: '4.8.7' };

  it('asks a user on their third day who was never asked', () => {
    expect(isDueForReview(pacing(), at)).toBe(true);
  });

  it('waits for three days of use', () => {
    expect(
      isDueForReview(pacing({ activeDays: THREE_DAYS.slice(1) }), at),
    ).toBe(false);
  });

  it('waits 120 days after a request', () => {
    const lastRequestedAt = NOW - 30 * DAY_MS;
    expect(
      isDueForReview(
        pacing({ lastRequestedAt, lastRequestedVersion: '4.8.6' }),
        at,
      ),
    ).toBe(false);
    expect(
      isDueForReview(
        pacing({
          lastRequestedAt: NOW - DAYS_BETWEEN_REQUESTS * DAY_MS,
          lastRequestedVersion: '4.8.6',
        }),
        at,
      ),
    ).toBe(true);
  });

  it('asks at most once per app version', () => {
    const lastRequestedAt = NOW - 200 * DAY_MS;
    expect(
      isDueForReview(
        pacing({ lastRequestedAt, lastRequestedVersion: '4.8.7' }),
        at,
      ),
    ).toBe(false);
  });
});

describe('askForReviewAfterSuccess', () => {
  let request: jest.SpyInstance;

  const onboarded = (value: boolean) =>
    useStore.setState({
      user: { ...(useStore.getState().user ?? {}), id: 'u1', onBoarded: value },
    } as Partial<ReturnType<typeof useStore.getState>>);

  beforeEach(() => {
    request = jest.spyOn(requirePlatform('reviewPrompt'), 'request');
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    jest.replaceProperty(
      requirePlatform('platformInfo'),
      'appVersion',
      '4.8.7',
    );
    useReviewPromptStore.setState({ ...pacing(), activeDays: [...THREE_DAYS] });
    onboarded(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('asks the OS once the device is due, and records it', () => {
    askForReviewAfterSuccess();
    expect(request).toHaveBeenCalledTimes(1);
    expect(useReviewPromptStore.getState()).toMatchObject({
      lastRequestedAt: NOW,
      lastRequestedVersion: '4.8.7',
    });
  });

  it('asks once, not again on the next success', () => {
    askForReviewAfterSuccess();
    askForReviewAfterSuccess();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('never asks during onboarding', () => {
    onboarded(false);
    askForReviewAfterSuccess();
    expect(request).not.toHaveBeenCalled();
  });

  it('never asks a user on their second day', () => {
    useReviewPromptStore.setState({ activeDays: THREE_DAYS.slice(1) });
    askForReviewAfterSuccess();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('useReviewPromptStore days of use', () => {
  it('counts a day once and keeps the last three', () => {
    useReviewPromptStore.setState({ activeDays: [] });
    const { recordActiveDay } = useReviewPromptStore.getState();
    [
      '2026-10-01',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ].forEach(recordActiveDay);
    expect(useReviewPromptStore.getState().activeDays).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });
});
