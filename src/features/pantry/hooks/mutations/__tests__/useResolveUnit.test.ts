import { renderHook } from '@testing-library/react-native';
import { useResolveUnit } from '../useResolveUnit';

const mockUnitQuery = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useLazyQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetUnitBySymbol')
      return [mockUnitQuery, { loading: false }];
    return { data: undefined, loading: false, error: undefined };
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useResolveUnit', () => {
  it('returns resolveUnitId function', () => {
    const { result } = renderHook(() => useResolveUnit());

    expect(typeof result.current.resolveUnitId).toBe('function');
  });

  it('returns currentUnitId if already set', async () => {
    const { result } = renderHook(() => useResolveUnit());

    const unitId = await result.current.resolveUnitId('existing-unit-id', 'kg');

    expect(unitId).toBe('existing-unit-id');
    expect(mockUnitQuery).not.toHaveBeenCalled();
  });

  it('returns null for empty symbol when no currentUnitId', async () => {
    const { result } = renderHook(() => useResolveUnit());

    const unitId = await result.current.resolveUnitId(null, '   ');

    expect(unitId).toBeNull();
    expect(mockUnitQuery).not.toHaveBeenCalled();
  });

  it('queries for unit by symbol and returns the id', async () => {
    mockUnitQuery.mockResolvedValue({
      data: { unitBySymbol: { id: 'resolved-unit-id' } },
    });

    const { result } = renderHook(() => useResolveUnit());

    const unitId = await result.current.resolveUnitId(null, 'kg');

    expect(mockUnitQuery).toHaveBeenCalledWith({
      variables: { symbol: 'kg' },
    });
    expect(unitId).toBe('resolved-unit-id');
  });

  it('trims whitespace from symbol before querying', async () => {
    mockUnitQuery.mockResolvedValue({
      data: { unitBySymbol: { id: 'unit-1' } },
    });

    const { result } = renderHook(() => useResolveUnit());

    await result.current.resolveUnitId(null, '  oz  ');

    expect(mockUnitQuery).toHaveBeenCalledWith({
      variables: { symbol: 'oz' },
    });
  });

  it('returns null when query returns no unit', async () => {
    mockUnitQuery.mockResolvedValue({
      data: { unitBySymbol: null },
    });

    const { result } = renderHook(() => useResolveUnit());

    const unitId = await result.current.resolveUnitId(null, 'xyz');

    expect(unitId).toBeNull();
  });

  it('returns null when query returns undefined data', async () => {
    mockUnitQuery.mockResolvedValue({ data: undefined });

    const { result } = renderHook(() => useResolveUnit());

    const unitId = await result.current.resolveUnitId(null, 'kg');

    expect(unitId).toBeNull();
  });
});
