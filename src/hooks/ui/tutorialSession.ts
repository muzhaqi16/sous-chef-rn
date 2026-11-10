import { useSyncExternalStore } from 'react';
import { requirePlatform } from '#platform/install';

/** A session runs from launch until a resume after this long in the background. */
const SESSION_GAP_MS = 30 * 60 * 1000;

interface TutorialSessionState {
  /** When this session began: an unasked tip after it takes the session's one. */
  startedAt: number;
  /** Tours "Not now" put away until the next session. */
  pausedTours: ReadonlySet<string>;
  /** Guides the user started from the Getting started card, until each ends. */
  startedGuides: ReadonlySet<string>;
  /** The tour that took the session's unasked slot, and whose it is. */
  unprompted: { userId: string | undefined; tour: string } | null;
  /** Onboarding finished in this session, which then shows nothing unasked. */
  onboardingFinished: boolean;
  /** The app is in the foreground. */
  active: boolean;
}

const fresh = (active: boolean): TutorialSessionState => ({
  startedAt: Date.now(),
  pausedTours: new Set(),
  startedGuides: new Set(),
  unprompted: null,
  onboardingFinished: false,
  active,
});

let state: TutorialSessionState | null = null;
const subscribers = new Set<() => void>();

const set = (next: TutorialSessionState) => {
  state = next;
  for (const notify of [...subscribers]) notify();
};

// Read where it is used, never while the module loads: the port is installed
// by then.
const current = (): TutorialSessionState => {
  if (state) return state;
  const lifecycle = requirePlatform('appLifecycle');
  state = fresh(lifecycle.current() === 'active');
  let backgroundSince: number | null = null;
  lifecycle.subscribe(next => {
    const now = Date.now();
    if (next !== 'active') {
      backgroundSince ??= now;
      if (state?.active) set({ ...state, active: false });
      return;
    }
    const away = backgroundSince === null ? 0 : now - backgroundSince;
    backgroundSince = null;
    set(
      away >= SESSION_GAP_MS
        ? fresh(true)
        : { ...(state ?? fresh(true)), active: true },
    );
  });
  return state;
};

/** Tour rationing for this session, shared by every sequence. */
export const tutorialSession = {
  /** "Not now": the tour stays away until the next session. */
  pause(tour: string) {
    const now = current();
    set({ ...now, pausedTours: new Set(now.pausedTours).add(tour) });
  },
  /** Takes this account's one unasked slot for the session for this tour. */
  claimUnprompted(userId: string | undefined, tour: string) {
    const now = current();
    if (now.unprompted?.userId === userId) return;
    set({ ...now, unprompted: { userId, tour } });
  },
  /** The user asked for this guide: it runs as one they started. */
  startGuide(tour: string) {
    const now = current();
    set({ ...now, startedGuides: new Set(now.startedGuides).add(tour) });
  },
  /** The guide ended, finished or put away; the card starts it again. */
  endGuide(tour: string) {
    const now = current();
    if (!now.startedGuides.has(tour)) return;
    const startedGuides = new Set(now.startedGuides);
    startedGuides.delete(tour);
    set({ ...now, startedGuides });
  },
  /** "Replay tips": what this session held back may show again now. */
  replay() {
    set(fresh(current().active));
  },
  /** Onboarding is done: nothing shows unasked for the rest of the session. */
  noteOnboardingFinished() {
    set({ ...current(), onboardingFinished: true });
  },
};

/** This session's tour state, re-read whenever it changes. */
export function useTutorialSession(): TutorialSessionState {
  return useSyncExternalStore(notify => {
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  }, current);
}

/**
 * Starts a fresh session, as a resume after a long absence does.
 * @internal Tests only.
 */
export function startTutorialSession(): void {
  set(fresh(true));
}
