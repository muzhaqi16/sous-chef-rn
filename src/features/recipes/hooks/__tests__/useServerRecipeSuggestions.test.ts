import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { useServerRecipeSuggestions } from '../useServerRecipeSuggestions';
import { RecipeSuggestionsDocument } from '../useServerRecipeSuggestions.generated';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/useToday', () => ({
  useToday: () => '2026-10-14',
}));

type Edge = NonNullable<
  NonNullable<
    NonNullable<
      MockDataFor<typeof RecipeSuggestionsDocument>['recipeSuggestions']
    >['edges']
  >[number]
>;

const edge = (
  id: string,
  name: string,
  coverage: number,
  expiring: string[] = [],
): Edge => ({
  __typename: 'RecipeSuggestionEdge',
  coverage,
  expiringStacks: expiring.map((itemName, index) => ({
    __typename: 'PantryItem',
    id: `stack-${id}-${index}`,
    itemName,
  })),
  node: {
    __typename: 'Recipe',
    id,
    name,
    servings: 4,
    totalTimeMinutes: 30,
    imageUrl: null,
  },
});

const suggestionsMock = (edges: Edge[]) =>
  recordMock(RecipeSuggestionsDocument, {
    data: {
      recipeSuggestions: {
        __typename: 'RecipeSuggestionConnection',
        edges,
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
  });

describe('useServerRecipeSuggestions', () => {
  it("lists the server's suggestions in its order, each opening its recipe", async () => {
    const suggestions = suggestionsMock([
      edge('r-own', 'My curry', 80),
      edge('r-pub', 'Pad thai', 60),
    ]);
    const { result } = renderHookWithApollo(
      () => useServerRecipeSuggestions(true),
      { operationMocks: [suggestions.mock] },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.items.map(item => item.id)).toEqual([
      'local-r-own',
      'local-r-pub',
    ]);
    expect(result.current.items[0]?.badge?.text).toBe(
      '80% of its ingredients in your pantry',
    );
    expect(result.current.unanswered).toBe(false);
  });

  it("asks for one page, with the device's date", async () => {
    const suggestions = suggestionsMock([edge('r-1', 'Soup', 50)]);
    const { result } = renderHookWithApollo(
      () => useServerRecipeSuggestions(true),
      { operationMocks: [suggestions.mock] },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    expect(suggestions.fired[0]).toEqual({ first: 20, today: '2026-10-14' });
  });

  it('names the stock about to expire that a suggestion uses', async () => {
    const { result } = renderHookWithApollo(
      () => useServerRecipeSuggestions(true),
      {
        operationMocks: [
          suggestionsMock([edge('r-1', 'Spinach pie', 70, ['Spinach'])]).mock,
        ],
      },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    expect(result.current.items[0]?.subtitle).toContain(
      'Uses Spinach before it expires',
    );
  });

  it('asks the server again on refresh', async () => {
    const suggestions = suggestionsMock([edge('r-1', 'Soup', 50)]);
    const { result } = renderHookWithApollo(
      () => useServerRecipeSuggestions(true),
      { operationMocks: [suggestions.mock] },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(suggestions.fired).toHaveLength(2);
  });

  it('is unanswered when the server suggests nothing', async () => {
    const { result } = renderHookWithApollo(
      () => useServerRecipeSuggestions(true),
      { operationMocks: [suggestionsMock([]).mock] },
    );

    await waitFor(() => expect(result.current.unanswered).toBe(true));
    expect(result.current.items).toEqual([]);
  });

  it('is unanswered when the server cannot answer', async () => {
    const failing = recordMock(RecipeSuggestionsDocument, {
      error: new Error('network down'),
    });
    const { result } = renderHookWithApollo(
      () => useServerRecipeSuggestions(true),
      { operationMocks: [failing.mock] },
    );

    await waitFor(() => expect(result.current.unanswered).toBe(true));
  });

  it('asks for nothing when switched off', () => {
    const suggestions = suggestionsMock([edge('r-1', 'Soup', 50)]);
    const { result } = renderHookWithApollo(
      () => useServerRecipeSuggestions(false),
      { operationMocks: [suggestions.mock] },
    );

    expect(suggestions.fired).toEqual([]);
    expect(result.current).toMatchObject({
      items: [],
      loading: false,
      unanswered: false,
    });
  });
});
