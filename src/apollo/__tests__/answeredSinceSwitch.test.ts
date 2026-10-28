import {
  forgetAnswersSinceSwitch,
  noteAnsweredInLanguage,
  startAnswersForSwitch,
  wasAnsweredSinceSwitch,
  wasAnsweredWholeSinceSwitch,
} from '../answeredSinceSwitch';

/**
 * Every search term and page is its own key, so a long session after one
 * language switch must not keep every answer it ever had.
 */
describe('answeredSinceSwitch', () => {
  beforeEach(() => startAnswersForSwitch());

  it('holds a bounded number of answers, dropping the stalest first', () => {
    noteAnsweredInLanguage('Pantry', { id: 'p1' });
    for (let term = 0; term < 2_000; term++) {
      noteAnsweredInLanguage('Search', { term: String(term) });
      // Answered again, so it is never the stalest.
      if (term % 100 === 0) noteAnsweredInLanguage('Pantry', { id: 'p1' });
    }

    expect(wasAnsweredSinceSwitch('Search', { term: '0' })).toBe(false);
    expect(wasAnsweredSinceSwitch('Search', { term: '1999' })).toBe(true);
    expect(wasAnsweredSinceSwitch('Pantry', { id: 'p1' })).toBe(true);
  });

  it('keeps a query answered whole as answered when a later answer errs', () => {
    noteAnsweredInLanguage('Pantry', { id: 'p1' });
    noteAnsweredInLanguage('Pantry', { id: 'p1' }, { erred: true });

    expect(wasAnsweredSinceSwitch('Pantry', { id: 'p1' })).toBe(true);
  });

  it('counts an answer whole as the end of a run of errors', () => {
    noteAnsweredInLanguage('Pantry', { id: 'p1' }, { erred: true });
    noteAnsweredInLanguage('Pantry', { id: 'p1' });

    expect(wasAnsweredSinceSwitch('Pantry', { id: 'p1' })).toBe(true);
  });

  // A query that keeps erring stops being re-asked, but what it holds is not
  // the server's answer.
  it('counts no answer with errors as whole, however many', () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      noteAnsweredInLanguage('Pantry', { id: 'p1' }, { erred: true });
    }

    expect(wasAnsweredSinceSwitch('Pantry', { id: 'p1' })).toBe(true);
    expect(wasAnsweredWholeSinceSwitch('Pantry', { id: 'p1' })).toBe(false);
    noteAnsweredInLanguage('Pantry', { id: 'p1' });
    expect(wasAnsweredWholeSinceSwitch('Pantry', { id: 'p1' })).toBe(true);
  });

  // The keys carry search terms and ids; the catch-up a switch started goes on.
  it("forgets every answer at a session end, and notes the next session's", () => {
    noteAnsweredInLanguage('Search', { term: 'gluten free' });

    forgetAnswersSinceSwitch();

    expect(wasAnsweredSinceSwitch('Search', { term: 'gluten free' })).toBe(
      false,
    );
    noteAnsweredInLanguage('Pantry', { id: 'p2' });
    expect(wasAnsweredSinceSwitch('Pantry', { id: 'p2' })).toBe(true);
  });
});
