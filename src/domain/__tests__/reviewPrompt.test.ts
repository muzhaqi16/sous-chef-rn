import { requirePlatform } from '#platform/install';
import { useStore } from '#store';
import { useReviewPromptStore } from '#store/reviewPromptStore';
import {
  _resetToastMoments,
  _setToastsShowing,
  noteTrouble,
} from '#/services/toastService';
import { memoryLifecycle } from '#/test-utils/memoryPlatform';
import {
  askForReviewAfterSuccess,
  CALM_AFTER_TROUBLE_MS,
  DAYS_BETWEEN_REQUESTS,
  isDueForReview,
  QUIET_MS,
} from '#/domain/reviewPrompt';

// The real one: the request waits on its toasts and the trouble it has seen.
jest.unmock('#/services/toastService');

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

  const after = (ms: number) => {
    jest.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    _resetToastMoments();
    request = jest.spyOn(requirePlatform('reviewPrompt'), 'request');
    jest.replaceProperty(
      requirePlatform('platformInfo'),
      'appVersion',
      '4.8.7',
    );
    useReviewPromptStore.setState({ ...pacing(), activeDays: [...THREE_DAYS] });
    onboarded(true);
    memoryLifecycle().moveTo('active');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('asks the OS once the toasts are quiet, and records it', () => {
    askForReviewAfterSuccess();
    expect(request).not.toHaveBeenCalled();

    after(QUIET_MS);
    expect(request).toHaveBeenCalledTimes(1);
    expect(useReviewPromptStore.getState()).toMatchObject({
      lastRequestedAt: NOW + QUIET_MS,
      lastRequestedVersion: '4.8.7',
    });
  });

  // Its toast may carry an Undo: the OS sheet must never cover it.
  it('waits for the success toast to go, then for quiet', () => {
    _setToastsShowing(true);
    askForReviewAfterSuccess();
    after(QUIET_MS * 3);
    expect(request).not.toHaveBeenCalled();

    _setToastsShowing(false);
    after(QUIET_MS - 1);
    expect(request).not.toHaveBeenCalled();
    after(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('starts the quiet again when another toast comes and goes', () => {
    askForReviewAfterSuccess();
    after(QUIET_MS - 1);
    _setToastsShowing(true);
    _setToastsShowing(false);
    after(QUIET_MS - 1);
    expect(request).not.toHaveBeenCalled();
    after(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('asks once, not again on the next success', () => {
    askForReviewAfterSuccess();
    askForReviewAfterSuccess();
    after(QUIET_MS);
    askForReviewAfterSuccess();
    after(QUIET_MS);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('never asks someone who has just seen an error', () => {
    noteTrouble();
    after(CALM_AFTER_TROUBLE_MS - QUIET_MS - 1);
    askForReviewAfterSuccess();
    after(QUIET_MS);
    expect(request).not.toHaveBeenCalled();

    after(1);
    askForReviewAfterSuccess();
    after(QUIET_MS);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('asks nothing when an error shows while it waits', () => {
    askForReviewAfterSuccess();
    noteTrouble();
    after(QUIET_MS);
    expect(request).not.toHaveBeenCalled();
  });

  it('asks nothing once the app has gone to the background', () => {
    askForReviewAfterSuccess();
    memoryLifecycle().moveTo('background');
    after(QUIET_MS);
    expect(request).not.toHaveBeenCalled();
    expect(useReviewPromptStore.getState().lastRequestedAt).toBeNull();
  });

  it('never asks during onboarding', () => {
    onboarded(false);
    askForReviewAfterSuccess();
    after(QUIET_MS);
    expect(request).not.toHaveBeenCalled();
  });

  it('never asks a user on their second day', () => {
    useReviewPromptStore.setState({ activeDays: THREE_DAYS.slice(1) });
    askForReviewAfterSuccess();
    after(QUIET_MS);
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
