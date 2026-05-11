import { waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRecipeFolders } from '../useRecipeFolders';

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function withFolders(folders: string[]) {
  return {
    mocks: {
      Query: () => ({ savedRecipeFolders: folders }),
    },
  };
}

describe('useRecipeFolders', () => {
  it('returns folder names from query', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeFolders(),
      withFolders(['Weeknight', 'Holiday', 'Quick']),
    );

    await waitFor(() =>
      expect(result.current.folders).toEqual(['Weeknight', 'Holiday', 'Quick']),
    );
  });

  it('returns empty array when data is empty', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeFolders(),
      withFolders([]),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.folders).toEqual([]);
  });

  it('exposes refetch function', () => {
    const { result } = renderHookWithApollo(
      () => useRecipeFolders(),
      withFolders([]),
    );

    expect(typeof result.current.refetch).toBe('function');
  });
});
