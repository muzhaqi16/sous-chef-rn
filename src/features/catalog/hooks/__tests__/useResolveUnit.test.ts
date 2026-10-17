import {
  recordMock,
  renderHookWithApollo,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import { GetUnitBySymbolDocument } from '#operations/item/unit.generated';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { useResolveUnit } from '../useResolveUnit';

const HELD = [
  { id: 'unit-lb', name: 'pound', symbol: 'lb', type: UnitType.Weight },
  {
    id: 'unit-floz',
    name: 'fluid ounce',
    symbol: 'fl oz',
    abbreviation: 'floz',
    type: UnitType.Volume,
  },
  { id: 'unit-carton', name: 'carton', symbol: 'carton', type: UnitType.Count },
  { id: 'unit-can', name: 'can', symbol: 'can', type: UnitType.Count },
  { id: 'unit-cup', name: 'cup', symbol: 'cup', type: UnitType.Volume },
];

let result: { current: ReturnType<typeof useResolveUnit> };
let fired: RecordedMock['fired'];

/** Mounts the hook over the device's state, with the API answering `answer`. */
function mountWith(
  state: { isOnline?: boolean; cachedUnits?: typeof HELD },
  answer: { id: string } | null = { id: 'from-api' },
) {
  useStore.setState({ isOnline: true, cachedUnits: [], ...state });
  const unit = recordMock(GetUnitBySymbolDocument, {
    data: { unitBySymbol: answer && { id: answer.id } },
  });
  fired = unit.fired;
  ({ result } = renderHookWithApollo(() => useResolveUnit(), {
    operationMocks: [unit.mock],
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useResolveUnit', () => {
  beforeEach(() => mountWith({}));

  it('returns currentUnitId if already set', async () => {
    expect(await result.current.resolveUnitId('existing-unit-id', 'kg')).toBe(
      'existing-unit-id',
    );
    expect(fired).toEqual([]);
  });

  it('returns null for empty symbol when no currentUnitId', async () => {
    expect(await result.current.resolveUnitId(null, '   ')).toBeNull();
    expect(fired).toEqual([]);
  });

  it('queries for unit by symbol and returns the id', async () => {
    expect(await result.current.resolveUnitId(null, 'kg')).toBe('from-api');
    expect(fired).toContainEqual({ symbol: 'kg' });
  });

  it('trims whitespace from symbol before querying', async () => {
    await result.current.resolveUnitId(null, '  oz  ');

    expect(fired).toContainEqual({ symbol: 'oz' });
  });

  it('returns null when query returns no unit', async () => {
    mountWith({}, null);

    expect(await result.current.resolveUnitId(null, 'xyz')).toBeNull();
  });
});

describe('useResolveUnit device first', () => {
  describe('online', () => {
    beforeEach(() => mountWith({ cachedUnits: HELD }));

    it.each([
      ['its symbol', 'lb', 'unit-lb'],
      ['its name, in any case', 'Pound', 'unit-lb'],
      ['its abbreviation', 'FLOZ', 'unit-floz'],
      ['a plural', 'lbs', 'unit-lb'],
    ])(
      'resolves a held unit by %s without asking the API',
      async (_how, text, id) => {
        expect(await result.current.resolveUnitId(null, text)).toBe(id);
        expect(fired).toEqual([]);
      },
    );

    it('reads a longer name typed with one letter wrong, and says what kind of unit it is', async () => {
      expect(await result.current.resolveUnit('cartoon')).toEqual({
        id: 'unit-carton',
        symbol: 'carton',
        type: UnitType.Count,
      });
      expect(await result.current.resolveUnit('pund')).toEqual({
        id: 'unit-lb',
        symbol: 'lb',
        type: UnitType.Weight,
      });
      expect(fired).toEqual([]);
    });

    it('asks the API, online, for a unit the device does not hold', async () => {
      expect(await result.current.resolveUnitId(null, 'tin')).toBe('from-api');
      expect(fired).toContainEqual({ symbol: 'tin' });
    });
  });

  describe('offline', () => {
    beforeEach(() => mountWith({ cachedUnits: HELD, isOnline: false }));

    it('guesses no typo in a short text, nor between two units as close', async () => {
      // `cap` is one letter from both can and cup, and short besides.
      expect(await result.current.resolveUnit('cap')).toBeNull();
      expect(await result.current.resolveUnit('cups')).toEqual(
        expect.objectContaining({ id: 'unit-cup' }),
      );
    });

    it('answers nothing offline for a unit the device does not hold', async () => {
      expect(await result.current.resolveUnitId(null, 'tin')).toBeNull();
      expect(fired).toEqual([]);
    });
  });
});
