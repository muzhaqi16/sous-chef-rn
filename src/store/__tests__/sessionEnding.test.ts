import {
  isSessionEnding,
  resetSessionEndingGate,
  whileSessionEnds,
} from '../sessionEnding';

/**
 * The gate `authLink` refuses operations behind. Left latched, the next
 * sign-in's Login cannot send; opened early, operations fire against a session
 * that is half cleared.
 */

beforeEach(() => resetSessionEndingGate());

describe('the session-ending gate', () => {
  it('is closed only while a session is ending', async () => {
    expect(isSessionEnding()).toBe(false);

    await whileSessionEnds(async () => {
      expect(isSessionEnding()).toBe(true);
    });

    expect(isSessionEnding()).toBe(false);
  });

  it('opens again when the session end throws', async () => {
    await expect(
      whileSessionEnds(() => Promise.reject(new Error('reset blew up'))),
    ).rejects.toThrow('reset blew up');

    expect(isSessionEnding()).toBe(false);
  });

  it('stays closed until the last overlapping session end finishes', async () => {
    let releaseInner!: () => void;
    const inner = new Promise<void>(resolve => {
      releaseInner = resolve;
    });

    const outer = whileSessionEnds(async () => {
      await whileSessionEnds(() => inner);
      // A sign-out and a server-ended session overlap; the inner release must
      // not open the gate the outer pass is still running under.
      expect(isSessionEnding()).toBe(true);
    });

    releaseInner();
    await outer;

    expect(isSessionEnding()).toBe(false);
  });
});
