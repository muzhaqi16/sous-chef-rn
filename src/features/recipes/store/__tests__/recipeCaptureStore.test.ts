import { SESSION_SCOPED_PERSISTED_KEYS } from '#store/sessionScopedStores';
import {
  CAPTURE_DEADLINE_MS,
  useRecipeCaptureStore,
  type CaptureEntry,
} from '#features/recipes/store/recipeCaptureStore';

const NOW = Date.parse('2026-10-14T12:00:00.000Z');

const reading = (
  id: string,
  createdAt = NOW,
): Omit<CaptureEntry, 'state' | 'answered'> => ({
  id,
  source: 'url',
  label: 'example-cooking.com',
  createdAt: new Date(createdAt).toISOString(),
});

beforeEach(() => {
  useRecipeCaptureStore.getState().reset();
});

describe('recipeCaptureStore', () => {
  it('keeps a capture unanswered until its create is answered', () => {
    const store = useRecipeCaptureStore.getState();
    store.addReading(reading('c-1'));
    expect(useRecipeCaptureStore.getState().entries).toEqual([
      expect.objectContaining({ id: 'c-1', answered: false }),
    ]);

    store.markAnswered('c-1');

    expect(useRecipeCaptureStore.getState().entries).toEqual([
      expect.objectContaining({ id: 'c-1', answered: true }),
    ]);
  });

  it('saves every capture as answered: a restart leaves no send in flight', () => {
    const store = useRecipeCaptureStore.getState();
    store.addReading(reading('c-1'));
    const { partialize } = useRecipeCaptureStore.persist.getOptions();

    expect(partialize?.(useRecipeCaptureStore.getState())).toEqual({
      entries: [expect.objectContaining({ id: 'c-1', answered: true })],
      held: [],
    });
  });

  // Version 1 remembered a capture only after its create was answered.
  it('reads a capture a version 1 build kept as answered', () => {
    const { migrate } = useRecipeCaptureStore.persist.getOptions();
    const { createdAt } = reading('c-1');

    expect(
      migrate?.(
        {
          entries: [{ ...reading('c-1'), createdAt, state: 'reading' }],
          held: [],
        },
        1,
      ),
    ).toEqual({
      entries: [expect.objectContaining({ id: 'c-1', answered: true })],
      held: [],
    });
  });

  it('keeps one entry per capture, however often it is asked for', () => {
    const store = useRecipeCaptureStore.getState();
    store.addReading(reading('c-1'));
    store.addReading(reading('c-1'));

    expect(useRecipeCaptureStore.getState().entries).toHaveLength(1);
  });

  it('holds a saved capture for its recipe, and forgets one that read nothing', () => {
    const store = useRecipeCaptureStore.getState();
    store.addReading(reading('c-saved'));
    store.addReading(reading('c-failed'));

    store.settle('c-saved', 'recipe-1');
    store.settle('c-failed');

    const { entries: left, held } = useRecipeCaptureStore.getState();
    expect(left).toEqual([]);
    expect(held).toEqual([
      expect.objectContaining({ captureId: 'c-saved', recipeId: 'recipe-1' }),
    ]);
  });

  it('keeps an incomplete capture for the user to finish, past the reading deadline', () => {
    const store = useRecipeCaptureStore.getState();
    store.addReading(reading('c-part', NOW - CAPTURE_DEADLINE_MS - 1));
    store.markIncomplete('c-part');

    store.prune(NOW);

    expect(useRecipeCaptureStore.getState().entries).toEqual([
      expect.objectContaining({ id: 'c-part', state: 'incomplete' }),
    ]);
  });

  it('drops a pending capture past the deadline the server keeps', () => {
    const store = useRecipeCaptureStore.getState();
    store.addReading(reading('c-old', NOW - CAPTURE_DEADLINE_MS - 1));
    store.addReading(reading('c-new', NOW - 1000));

    store.prune(NOW);

    expect(useRecipeCaptureStore.getState().entries.map(e => e.id)).toEqual([
      'c-new',
    ]);
  });

  it('is persisted under a key a sign-out clears', () => {
    const { name } = useRecipeCaptureStore.persist.getOptions();

    expect(SESSION_SCOPED_PERSISTED_KEYS).toContain(name);
  });
});
