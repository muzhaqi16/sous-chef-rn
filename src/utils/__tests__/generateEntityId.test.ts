import { generateEntityId } from '../generateEntityId';

describe('generateEntityId', () => {
  it('emits a classic cuid v1 matching the server PK format', () => {
    const id = generateEntityId();
    // Must match Prisma @default(cuid()) — /^c[a-z0-9]{24}$/, 25 chars.
    expect(id).toMatch(/^c[a-z0-9]{24}$/);
    expect(id).toHaveLength(25);
  });

  it('emits unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateEntityId()));
    expect(ids.size).toBe(1000);
  });
});
