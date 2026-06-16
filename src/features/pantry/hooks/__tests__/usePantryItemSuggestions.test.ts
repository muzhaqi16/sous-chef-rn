import React, { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { GetPantryItemSuggestionsDocument } from '#features/pantry/graphql/pantry.generated';
import { PantrySuggestionSource } from '#/graphql/generated/schemaTypes';
import { usePantryItemSuggestions } from '../usePantryItemSuggestions';

let mockIsOffline = false;
jest.mock('#hooks/settings/useOfflineMode', () => ({
  useIsEffectivelyOffline: () => mockIsOffline,
}));

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: (item: { imageUrl?: string | null } | null | undefined) =>
    item?.imageUrl ? `https://cdn.test/${item.imageUrl}` : null,
}));

const mockPreloadImages = jest.fn();
jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: (...args: unknown[]) => mockPreloadImages(...args),
}));

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'PantryItemSuggestion',
    id: 'sug-1',
    itemId: 'item-1',
    name: 'Milk',
    source: PantrySuggestionSource.LowStock,
    imageUrl: 'milk.jpg',
    category: null,
    defaultUnitId: null,
    currentQuantity: null,
    minQuantity: null,
    restockQuantity: null,
    daysUntilExpiry: null,
    expiresAt: null,
    lastQuantity: null,
    lastUnitId: null,
    frequencyCount: null,
    popularityRank: null,
    pantryItemId: null,
    defaultUnit: null,
    item: {
      __typename: 'SuggestionItem',
      id: 'item-1',
      name: 'Milk',
      imageUrl: null,
    },
    ...overrides,
  };
}

function buildMock(
  suggestions: ReturnType<typeof makeSuggestion>[],
  variables: { pantryId: string; limit: number } = {
    pantryId: 'pantry-1',
    limit: 20,
  },
): MockedResponse {
  // Each source is fetched via its own aliased field; bucket the flat input.
  const bySource = (source: PantrySuggestionSource) =>
    suggestions.filter(s => s.source === source);
  return {
    request: { query: GetPantryItemSuggestionsDocument, variables },
    result: {
      data: {
        pantry: {
          __typename: 'Pantry',
          id: variables.pantryId,
          lowStock: bySource(PantrySuggestionSource.LowStock),
          expiringSoon: bySource(PantrySuggestionSource.ExpiringSoon),
          recentlyDeleted: bySource(PantrySuggestionSource.RecentlyDeleted),
          frequentlyAdded: bySource(PantrySuggestionSource.FrequentlyAdded),
          popular: bySource(PantrySuggestionSource.Popular),
        },
      },
    },
  };
}

function renderWith(
  mocks: MockedResponse[],
  props: Parameters<typeof usePantryItemSuggestions>[0],
) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(
      MockedProvider,
      { mocks, showWarnings: false },
      children,
    );
  return renderHook(() => usePantryItemSuggestions(props), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOffline = false;
});

describe('usePantryItemSuggestions', () => {
  it('returns empty state before the network resolves', () => {
    const { result } = renderWith([buildMock([makeSuggestion()])], {
      pantryId: 'pantry-1',
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  it('returns suggestions with resolved imageUrl after the network resolves', async () => {
    const { result } = renderWith([buildMock([makeSuggestion()])], {
      pantryId: 'pantry-1',
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].imageUrl).toBe(
      'https://cdn.test/milk.jpg',
    );
    expect(result.current.hasSuggestions).toBe(true);
  });

  it('returns null imageUrl when suggestion has no image', async () => {
    const { result } = renderWith(
      [buildMock([makeSuggestion({ imageUrl: null })])],
      { pantryId: 'pantry-1' },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.suggestions[0].imageUrl).toBeNull();
  });

  describe('grouping by source', () => {
    it('groups suggestions by PantrySuggestionSource', async () => {
      const { result } = renderWith(
        [
          buildMock([
            makeSuggestion({
              id: '1',
              source: PantrySuggestionSource.LowStock,
            }),
            makeSuggestion({
              id: '2',
              source: PantrySuggestionSource.ExpiringSoon,
            }),
            makeSuggestion({
              id: '3',
              source: PantrySuggestionSource.LowStock,
            }),
            makeSuggestion({ id: '4', source: PantrySuggestionSource.Popular }),
            makeSuggestion({
              id: '5',
              source: PantrySuggestionSource.FrequentlyAdded,
            }),
            makeSuggestion({
              id: '6',
              source: PantrySuggestionSource.RecentlyDeleted,
            }),
          ]),
        ],
        { pantryId: 'pantry-1' },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.grouped.lowStock).toHaveLength(2);
      expect(result.current.grouped.expiringSoon).toHaveLength(1);
      expect(result.current.grouped.popular).toHaveLength(1);
      expect(result.current.grouped.frequentlyAdded).toHaveLength(1);
      expect(result.current.grouped.recentlyDeleted).toHaveLength(1);
    });

    it('returns empty groups when no suggestions', async () => {
      const { result } = renderWith([buildMock([])], { pantryId: 'pantry-1' });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.grouped.lowStock).toHaveLength(0);
      expect(result.current.grouped.expiringSoon).toHaveLength(0);
      expect(result.current.grouped.popular).toHaveLength(0);
      expect(result.current.grouped.frequentlyAdded).toHaveLength(0);
      expect(result.current.grouped.recentlyDeleted).toHaveLength(0);
    });
  });

  describe('offline behavior', () => {
    it('returns empty suggestions when offline (no network call fires)', () => {
      mockIsOffline = true;
      // No mock provided — if the query fired, MockedProvider would error
      const { result } = renderWith([], { pantryId: 'pantry-1' });

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.hasSuggestions).toBe(false);
      expect(result.current.isOffline).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('image preloading', () => {
    it('preloads images when suggestions have URLs', async () => {
      const { result } = renderWith(
        [
          buildMock([
            makeSuggestion({ id: '1', imageUrl: 'img1.jpg' }),
            makeSuggestion({ id: '2', imageUrl: 'img2.jpg' }),
            makeSuggestion({ id: '3', imageUrl: null }),
          ]),
        ],
        { pantryId: 'pantry-1' },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockPreloadImages).toHaveBeenCalledWith([
        'https://cdn.test/img1.jpg',
        'https://cdn.test/img2.jpg',
      ]);
    });

    it('does not preload when no suggestions', async () => {
      const { result } = renderWith([buildMock([])], { pantryId: 'pantry-1' });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockPreloadImages).not.toHaveBeenCalled();
    });
  });

  describe('skip conditions', () => {
    it('skips query when pantryId is undefined', () => {
      const { result } = renderWith([], { pantryId: undefined });

      expect(result.current.loading).toBe(false);
      expect(result.current.suggestions).toEqual([]);
    });

    it('skips query when skip option is true', () => {
      const { result } = renderWith([], { pantryId: 'pantry-1', skip: true });

      expect(result.current.loading).toBe(false);
      expect(result.current.suggestions).toEqual([]);
    });
  });

  describe('limit variable', () => {
    it('uses default limit of 20 (mock matches limit=20)', async () => {
      const { result } = renderWith(
        [buildMock([makeSuggestion()], { pantryId: 'pantry-1', limit: 20 })],
        { pantryId: 'pantry-1' },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.suggestions).toHaveLength(1);
    });

    it('uses custom limit when provided (mock matches limit=5)', async () => {
      const { result } = renderWith(
        [buildMock([makeSuggestion()], { pantryId: 'pantry-1', limit: 5 })],
        { pantryId: 'pantry-1', limit: 5 },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.suggestions).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('exposes refetch function', async () => {
      const { result } = renderWith([buildMock([])], { pantryId: 'pantry-1' });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(typeof result.current.refetch).toBe('function');
    });

    it('exposes error from query', async () => {
      const { result } = renderWith(
        [
          {
            request: {
              query: GetPantryItemSuggestionsDocument,
              variables: { pantryId: 'pantry-1', limit: 20 },
            },
            error: new Error('Failed'),
          },
        ],
        { pantryId: 'pantry-1' },
      );

      await waitFor(() => expect(result.current.error).toBeDefined());

      expect(result.current.error?.message).toBe('Failed');
    });
  });
});
