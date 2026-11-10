import { createTestStore } from '#/test-utils/createTestStore';
import { featureHintKey } from '../tutorialSlice';

const seeded = () =>
  createTestStore({
    featureHintsShown: {
      [featureHintKey('a', 'first_shop')]: true,
      [featureHintKey('a', 'pantry_swipe')]: true,
      [featureHintKey('b', 'first_shop')]: true,
    },
    lastUnpromptedTipAt: { a: 10, b: 20 },
    gettingStarted: {
      a: { hidden: true, done: ['addItem'], retired: false },
      b: { hidden: true, done: ['addItem'], retired: false },
    },
  });

describe('tutorialSlice', () => {
  it('keys a hint by account, or by the feature alone with none', () => {
    expect(featureHintKey('a', 'first_shop')).toBe(
      'feature_hint_shown_a_first_shop',
    );
    expect(featureHintKey(undefined, 'first_shop')).toBe(
      'feature_hint_shown_first_shop',
    );
  });

  describe('clearTipsFor', () => {
    it('brings back one account’s hints, unasked clock and card', () => {
      const store = seeded();

      store.getState().clearTipsFor('a');

      const state = store.getState();
      expect(state.featureHintsShown).toEqual({
        [featureHintKey('b', 'first_shop')]: true,
      });
      expect(state.lastUnpromptedTipAt).toEqual({ b: 20 });
      expect(state.gettingStarted.a).toEqual({
        hidden: false,
        done: ['addItem'],
        retired: false,
      });
      expect(state.gettingStarted.b?.hidden).toBe(true);
    });

    it('leaves a card whose every item is done retired', () => {
      const store = createTestStore({
        gettingStarted: { a: { hidden: true, done: [], retired: true } },
      });

      store.getState().clearTipsFor('a');

      expect(store.getState().gettingStarted.a?.hidden).toBe(true);
    });
  });

  it('keeps what an account has done for tips, through Replay tips', () => {
    const store = createTestStore();

    store.getState().noteTipFact('a', 'recipeSaved');
    store.getState().noteTipFact('a', 'recipeSaved');
    store.getState().clearTipsFor('a');

    expect(store.getState().tipFacts).toEqual({ a: ['recipeSaved'] });
  });

  it('records when a tip last showed unasked, per account', () => {
    const store = createTestStore();

    store.getState().recordUnpromptedTip('a', 42);

    expect(store.getState().lastUnpromptedTipAt).toEqual({ a: 42 });
  });
});
