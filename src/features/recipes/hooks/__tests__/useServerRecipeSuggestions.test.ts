import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useServerRecipeSuggestions } from '../useServerRecipeSuggestions';
import { RecipeSuggestionsDocument } from '../useServerRecipeSuggestions.generated';

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

// `expiringStacks` is stated even when empty: left out, the SDL fills entries.
const edge = (id: string, coverage: number, expiring: string[] = []): Edge => ({
  coverage,
  expiringStacks: expiring.map((itemName, index) => ({
    id: `stack-${id}-${index}`,
    itemName,
  })),
  node: { id },
});

const suggestionsMock = (edges: Edge[]) =>
  recordMock(RecipeSuggestionsDocument, {
    data: { recipeSuggestions: { edges } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  });

const renderSuggestions = (operationMocks: MockedResponse[], enabled = true) =>
  renderHookWithApollo(() => useServerRecipeSuggestions(enabled), {
    operationMocks,
  });

describe('useServerRecipeSuggestions', () => {
  it("lists the server's suggestions in its order, each opening its recipe", async () => {
    const { result } = renderSuggestions([
      suggestionsMock([edge('r-own', 80), edge('r-pub', 60)]).mock,
    ]);

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
    const suggestions = suggestionsMock([edge('r-1', 50)]);
    const { result } = renderSuggestions([suggestions.mock]);

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    expect(suggestions.fired[0]).toEqual({ first: 20, today: '2026-10-14' });
  });

  it.each([
    {
      name: 'names the stock about to expire that a suggestion uses',
      expiring: ['Spinach'],
      uses: 'Uses Spinach before it expires',
    },
    {
      name: 'names an item once however many of its stacks are expiring',
      expiring: ['milk', 'Milk ', 'eggs'],
      uses: 'Uses milk, eggs before they expire',
    },
  ])('$name', async ({ expiring, uses }) => {
    const { result } = renderSuggestions([
      suggestionsMock([edge('r-1', 70, expiring)]).mock,
    ]);

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    expect(result.current.items[0]?.subtitle).toContain(uses);
  });

  it('asks the server again on refresh', async () => {
    const suggestions = suggestionsMock([edge('r-1', 50)]);
    const { result } = renderSuggestions([suggestions.mock]);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(suggestions.fired).toHaveLength(2);
  });

  it.each([
    {
      name: 'is unanswered when the server suggests nothing',
      answer: () => suggestionsMock([]).mock,
    },
    {
      name: 'is unanswered when the server cannot answer',
      answer: () =>
        recordMock(RecipeSuggestionsDocument, {
          error: new Error('network down'),
        }).mock,
    },
  ])('$name', async ({ answer }) => {
    const { result } = renderSuggestions([answer()]);

    await waitFor(() => expect(result.current.unanswered).toBe(true));
    expect(result.current.items).toEqual([]);
  });

  it('asks for nothing when switched off', () => {
    const suggestions = suggestionsMock([edge('r-1', 50)]);
    const { result } = renderSuggestions([suggestions.mock], false);

    expect(suggestions.fired).toEqual([]);
    expect(result.current).toMatchObject({
      items: [],
      loading: false,
      unanswered: false,
    });
  });
});
