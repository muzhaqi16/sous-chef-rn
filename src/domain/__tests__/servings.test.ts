import { startingServings } from '../servings';

describe('startingServings', () => {
  it('starts at who the user cooks for', () => {
    expect(startingServings(4, 2)).toBe(4);
  });

  it("starts at the fallback when the question wasn't answered", () => {
    expect(startingServings(null, 6)).toBe(6);
    expect(startingServings(undefined, 2)).toBe(2);
  });
});
