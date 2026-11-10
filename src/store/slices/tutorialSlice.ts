// ============================================
// Per-account tutorial progress: the hints shown, the Getting started card,
// the unasked-tip clock, the push ask, and how many times each account has
// signed in (post-login modals space themselves out with it). Keyed by user
// so a shared device keeps them apart, and kept through sign-out.
// ============================================

import type { StateCreator } from 'zustand';
import type { RootState } from '../index';

/** One account's Getting started card. */
export interface GettingStartedRecord {
  hidden: boolean;
  /** The items done, by id. */
  done: string[];
  /** Every item done once: the card does not come back. */
  retired: boolean;
}

const FEATURE_HINT_PREFIX = 'feature_hint_shown_';

/** A hint's key in `featureHintsShown`; with no account, the bare feature id. */
export const featureHintKey = (userId: string | undefined, featureId: string) =>
  userId
    ? `${FEATURE_HINT_PREFIX}${userId}_${featureId}`
    : `${FEATURE_HINT_PREFIX}${featureId}`;

export interface TutorialState {
  /** `featureHintKey(userId, featureId)` → shown. */
  featureHintsShown: Record<string, boolean>;
  loginCounts: Record<string, number>;
  /** Per account; kept through sign-out, like the hints. */
  gettingStarted: Record<string, GettingStartedRecord>;
  /** Per account: when a tip last showed unasked, for the session's one. */
  lastUnpromptedTipAt: Record<string, number>;
  /** Per account: the push ask was answered, yes or no. */
  pushAskAnswered: Record<string, boolean>;
  /**
   * Per account: what it has done that a contextual tip waits for, such as a
   * first saved recipe. Replay tips keeps them: they are facts, not tips.
   */
  tipFacts: Record<string, string[]>;

  markFeatureHintShown: (key: string) => void;
  incrementLoginCount: (userId: string) => void;
  recordUnpromptedTip: (userId: string, at: number) => void;
  /** Getting started items seen done; they stay done on this device. */
  markGettingStartedDone: (userId: string, items: string[]) => void;
  /** The user hid the card; Replay tips brings it back. */
  hideGettingStarted: (userId: string) => void;
  /** Every item done and acknowledged: the card does not come back. */
  retireGettingStarted: (userId: string) => void;
  /** The notification ask was answered here, yes or no: it is not made again. */
  answerPushAsk: (userId: string) => void;
  noteTipFact: (userId: string, fact: string) => void;
  /**
   * One account's tours and tips, shown again: its hints, its unasked-tip
   * clock, and its Getting started card unless every item is done. Other
   * accounts on the device keep theirs.
   */
  clearTipsFor: (userId: string) => void;
}

export const initialTutorialState = {
  featureHintsShown: {},
  loginCounts: {},
  gettingStarted: {},
  lastUnpromptedTipAt: {},
  pushAskAnswered: {},
  tipFacts: {},
};

export const createTutorialSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  TutorialState
> = set => ({
  ...initialTutorialState,

  markFeatureHintShown: key => {
    set(state => {
      state.featureHintsShown[key] = true;
    });
  },

  incrementLoginCount: userId => {
    set(state => {
      state.loginCounts[userId] = (state.loginCounts[userId] ?? 0) + 1;
    });
  },

  recordUnpromptedTip: (userId, at) => {
    set(state => {
      state.lastUnpromptedTipAt[userId] = at;
    });
  },

  markGettingStartedDone: (userId, items) => {
    set(state => {
      const card = (state.gettingStarted[userId] ??= {
        hidden: false,
        done: [],
        retired: false,
      });
      for (const item of items) {
        if (!card.done.includes(item)) card.done.push(item);
      }
    });
  },

  hideGettingStarted: userId => {
    set(state => {
      const card = (state.gettingStarted[userId] ??= {
        hidden: false,
        done: [],
        retired: false,
      });
      card.hidden = true;
    });
  },

  noteTipFact: (userId, fact) => {
    set(state => {
      const facts = (state.tipFacts[userId] ??= []);
      if (!facts.includes(fact)) facts.push(fact);
    });
  },

  answerPushAsk: userId => {
    set(state => {
      state.pushAskAnswered[userId] = true;
    });
  },

  retireGettingStarted: userId => {
    set(state => {
      const card = (state.gettingStarted[userId] ??= {
        hidden: false,
        done: [],
        retired: false,
      });
      card.retired = true;
    });
  },

  clearTipsFor: userId => {
    set(state => {
      const prefix = featureHintKey(userId, '');
      for (const key of Object.keys(state.featureHintsShown)) {
        if (key.startsWith(prefix)) delete state.featureHintsShown[key];
      }
      delete state.lastUnpromptedTipAt[userId];
      const card = state.gettingStarted[userId];
      if (card && !card.retired) card.hidden = false;
    });
  },
});
