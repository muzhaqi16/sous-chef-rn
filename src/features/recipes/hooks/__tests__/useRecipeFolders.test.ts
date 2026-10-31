import { useApolloClient } from '@apollo/client/react';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { SavedRecipeFoldersDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeFolders } from '../useRecipeFolders';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

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

    await drainTimers();
    expect(result.current.folders).toEqual(['Weeknight', 'Holiday', 'Quick']);
  });

  it('returns empty array when data is empty', async () => {
    const { result } = renderHookWithApollo(
      () => ({ ...useRecipeFolders(), client: useApolloClient() }),
      withFolders([]),
    );

    await drainTimers();
    expect(
      result.current.client.cache.readQuery({
        query: SavedRecipeFoldersDocument,
      }),
    ).not.toBeNull();
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
