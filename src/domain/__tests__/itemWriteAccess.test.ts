import { writesItemDirectly } from '../itemWriteAccess';

describe('writesItemDirectly', () => {
  it('writes only the viewer’s own private item', () => {
    expect(writesItemDirectly({ canEdit: true, canSuggest: false })).toBe(true);
  });

  it('never writes a public item, even for an admin', () => {
    expect(writesItemDirectly({ canEdit: true, canSuggest: true })).toBe(false);
    expect(writesItemDirectly({ canEdit: false, canSuggest: true })).toBe(
      false,
    );
  });

  it('writes nothing it has no flags for, or may not touch', () => {
    expect(writesItemDirectly({})).toBe(false);
    expect(writesItemDirectly({ canEdit: false, canSuggest: false })).toBe(
      false,
    );
  });
});
