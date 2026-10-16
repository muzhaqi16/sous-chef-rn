import {
  recordMock,
  renderHookWithApollo,
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

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ isOnline: true, cachedUnits: [] });
});

function unitMock(unit: { id: string } | null) {
  return recordMock(GetUnitBySymbolDocument, {
    data: {
      unitBySymbol: unit ? { __typename: 'Unit', id: unit.id } : null,
    },
  });
}

describe('useResolveUnit', () => {
  it('returns resolveUnitId function', () => {
    const { result } = renderHookWithApollo(() => useResolveUnit());

    expect(typeof result.current.resolveUnitId).toBe('function');
  });

  it('returns currentUnitId if already set', async () => {
    const m = unitMock({ id: 'resolved' });
    const { result } = renderHookWithApollo(() => useResolveUnit(), {
      operationMocks: [m.mock],
    });

    const unitId = await result.current.resolveUnitId('existing-unit-id', 'kg');

    expect(unitId).toBe('existing-unit-id');
    expect(m.fired).toEqual([]);
  });

  it('returns null for empty symbol when no currentUnitId', async () => {
    const m = unitMock({ id: 'resolved' });
    const { result } = renderHookWithApollo(() => useResolveUnit(), {
      operationMocks: [m.mock],
    });

    const unitId = await result.current.resolveUnitId(null, '   ');

    expect(unitId).toBeNull();
    expect(m.fired).toEqual([]);
  });

  it('queries for unit by symbol and returns the id', async () => {
    const m = unitMock({ id: 'resolved-unit-id' });
    const { result } = renderHookWithApollo(() => useResolveUnit(), {
      operationMocks: [m.mock],
    });

    const unitId = await result.current.resolveUnitId(null, 'kg');

    expect(m.fired).toContainEqual({ symbol: 'kg' });
    expect(unitId).toBe('resolved-unit-id');
  });

  it('trims whitespace from symbol before querying', async () => {
    const m = unitMock({ id: 'unit-1' });
    const { result } = renderHookWithApollo(() => useResolveUnit(), {
      operationMocks: [m.mock],
    });

    await result.current.resolveUnitId(null, '  oz  ');

    expect(m.fired).toContainEqual({ symbol: 'oz' });
  });

  it('returns null when query returns no unit', async () => {
    const m = unitMock(null);
    const { result } = renderHookWithApollo(() => useResolveUnit(), {
      operationMocks: [m.mock],
    });

    const unitId = await result.current.resolveUnitId(null, 'xyz');

    expect(unitId).toBeNull();
  });

  describe('device first', () => {
    beforeEach(() => {
      useStore.setState({ cachedUnits: HELD });
    });

    it.each([
      ['its symbol', 'lb', 'unit-lb'],
      ['its name, in any case', 'Pound', 'unit-lb'],
      ['its abbreviation', 'FLOZ', 'unit-floz'],
      ['a plural', 'lbs', 'unit-lb'],
    ])(
      'resolves a held unit by %s without asking the API',
      async (_how, text, id) => {
        const m = unitMock({ id: 'from-api' });
        const { result } = renderHookWithApollo(() => useResolveUnit(), {
          operationMocks: [m.mock],
        });

        expect(await result.current.resolveUnitId(null, text)).toBe(id);
        expect(m.fired).toEqual([]);
      },
    );

    it('reads a longer name typed with one letter wrong, and says what kind of unit it is', async () => {
      const m = unitMock({ id: 'from-api' });
      const { result } = renderHookWithApollo(() => useResolveUnit(), {
        operationMocks: [m.mock],
      });

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
      expect(m.fired).toEqual([]);
    });

    it('guesses no typo in a short text, nor between two units as close', async () => {
      useStore.setState({ isOnline: false });
      const { result } = renderHookWithApollo(() => useResolveUnit());

      // `cap` is one letter from both can and cup, and short besides.
      expect(await result.current.resolveUnit('cap')).toBeNull();
      expect(await result.current.resolveUnit('cups')).toEqual(
        expect.objectContaining({ id: 'unit-cup' }),
      );
    });

    it('answers nothing offline for a unit the device does not hold', async () => {
      useStore.setState({ isOnline: false });
      const m = unitMock({ id: 'from-api' });
      const { result } = renderHookWithApollo(() => useResolveUnit(), {
        operationMocks: [m.mock],
      });

      expect(await result.current.resolveUnitId(null, 'tin')).toBeNull();
      expect(m.fired).toEqual([]);
    });

    it('asks the API, online, for a unit the device does not hold', async () => {
      const m = unitMock({ id: 'from-api' });
      const { result } = renderHookWithApollo(() => useResolveUnit(), {
        operationMocks: [m.mock],
      });

      expect(await result.current.resolveUnitId(null, 'tin')).toBe('from-api');
      expect(m.fired).toContainEqual({ symbol: 'tin' });
    });
  });
});
