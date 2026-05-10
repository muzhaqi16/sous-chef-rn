import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetUnitBySymbolDocument } from '#operations/item/unit.generated';
import { useResolveUnit } from '../useResolveUnit';

beforeEach(() => {
  jest.clearAllMocks();
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
});
