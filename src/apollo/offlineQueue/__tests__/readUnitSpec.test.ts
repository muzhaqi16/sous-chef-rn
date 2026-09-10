import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { readUnitSpec } from '#/apollo/offlineQueue/syncBuilder';

/**
 * A queued write names its unit by id, and an id the vocabulary repair retired
 * cannot be re-resolved on replay — a symbol can. So the cached symbol has to
 * ride alongside the id, or the replay is refused and the write is lost.
 */
const UNIT_FRAGMENT = gql`
  fragment TestUnit on Unit {
    id
    name
    symbol
  }
`;

const seedUnit = (fields: { id: string; name?: string; symbol?: string }) => {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'Unit', id: fields.id }),
    fragment: UNIT_FRAGMENT,
    data: {
      __typename: 'Unit',
      name: 'tablespoon',
      symbol: 'tbsp',
      ...fields,
    },
  });
  return cache;
};

describe('readUnitSpec', () => {
  it('carries the cached symbol beside a queued unit id', () => {
    const cache = seedUnit({ id: 'unit-1', symbol: 'tbsp' });

    expect(readUnitSpec(cache, { unitId: 'unit-1' })).toEqual({
      unitId: 'unit-1',
      unitSymbol: 'tbsp',
    });
  });

  it('falls back to the id alone when the unit was never cached', () => {
    // Best effort: the replay still names the unit, and the server resolves it
    // if the id survived the repair.
    expect(readUnitSpec(makeCache(), { unitId: 'unknown' })).toEqual({
      unitId: 'unknown',
    });
  });

  it('leaves a spec that already carries a symbol alone', () => {
    const cache = seedUnit({ id: 'unit-1', symbol: 'tbsp' });
    const spec = { unitId: 'unit-1', unitSymbol: 'stale-tbsp' };

    expect(readUnitSpec(cache, spec)).toBe(spec);
  });

  it('drops a spec that names no unit at all', () => {
    // The caller spreads the result conditionally, so `undefined` means the
    // replayed mutation omits `unit` rather than sending an empty one.
    expect(readUnitSpec(makeCache(), {})).toBeUndefined();
  });

  it('keeps a name-only spec, which is re-resolvable without an id', () => {
    expect(readUnitSpec(makeCache(), { unitName: 'tablespoon' })).toEqual({
      unitName: 'tablespoon',
    });
  });
});
