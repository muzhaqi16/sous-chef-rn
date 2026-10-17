import { storeNameKey } from '../storeNameKey';

describe('storeNameKey', () => {
  // The API's own pairs (sous-chef-api `storeMatchKey.ts`): one shop each.
  it.each([
    ['Giant Eagle', 'GIANT EAGLE'],
    ['East End Food Co-Op', 'east end food coop'],
    ['Café Ñandú', 'CAFE NANDU'],
    ['Smørrebrød Haus', 'smorrebrod haus'],
    ['Straße Markt', 'strasse markt'],
    ['Aldi #27', 'ALDI 27'],
  ])('keys %p as %p does', (name, other) => {
    expect(storeNameKey(name)).toBe(storeNameKey(other));
  });

  it('keeps only letters and digits, accents and case folded', () => {
    expect(storeNameKey('  Trader Joe’s — #552 ')).toBe('traderjoes552');
    expect(storeNameKey('Tańska Żabka')).toBe('tanskazabka');
  });

  it('keeps letters that are not Latin', () => {
    expect(storeNameKey('Ελληνικό Παντοπωλείο')).toBe(
      storeNameKey('ΕΛΛΗΝΙΚΟ ΠΑΝΤΟΠΩΛΕΙΟ'),
    );
    expect(storeNameKey('Ελληνικό Παντοπωλείο')).not.toBe('');
  });

  it('is empty for a name with no letter or digit', () => {
    expect(storeNameKey('— · —')).toBe('');
  });

  it('tells two shops apart', () => {
    expect(storeNameKey('Giant Eagle')).not.toBe(
      storeNameKey('Giant Eagle Market District'),
    );
  });
});
