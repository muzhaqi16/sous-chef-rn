import { isCuid } from '@paralleldrive/cuid2';
import { generateEntityId } from '../generateEntityId';

// Server id validator (sous-chef-api/src/utils/common/validateId.ts): accepts
// cuid2 and legacy cuid v1 / 24-char hex. New ids must satisfy this.
const SERVER_ID_REGEX = /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/;

describe('generateEntityId', () => {
  it('emits a cuid2 accepted by the server PK validator', () => {
    const id = generateEntityId();
    expect(isCuid(id)).toBe(true);
    expect(id).toMatch(SERVER_ID_REGEX);
  });

  it('emits unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateEntityId()));
    expect(ids.size).toBe(1000);
  });
});
