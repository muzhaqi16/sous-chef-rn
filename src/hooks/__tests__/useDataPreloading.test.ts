import { renderHook } from '@testing-library/react-native';
import { useDataPreloading } from '../useDataPreloading';

describe('useDataPreloading', () => {
  it('is a no-op shell for future reference data preloads', () => {
    // useDataPreloading is currently a shell — units preloading was moved
    // to useUnitAutocomplete (lazy, fires on first AddItemSheet open).
    const { result } = renderHook(() => useDataPreloading());
    expect(result.current).toBeUndefined();
  });
});
