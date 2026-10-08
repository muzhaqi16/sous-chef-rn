import {
  noteAnsweredInLanguage,
  startAnswersForSwitch,
  wasAnsweredSinceSwitch,
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
});
