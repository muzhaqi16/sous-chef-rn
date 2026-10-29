import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useServerRecipeSuggestions } from '../useServerRecipeSuggestions';
import { RecipeSuggestionsDocument } from '../useServerRecipeSuggestions.generated';
import { getI18n } from '#/i18n/config';
import { toDisplayItems } from '#features/recipes/screens/recipeDisplayItems';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import { useStore } from '#store';

jest.mock('#hooks/app/useToday', () => ({
  useToday: () => '2026-10-14',
}));

// The cards as the list shows them, in the copy of en.json.
const shown = (rows: RecipeRow[]) => toDisplayItems(rows, getI18n().t);

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

/** A ranking the server gives for one home only. */
const homeRanking = (
  homeId: string,
  edges: Edge[],
  options: { held?: boolean } = {},
) =>
  recordMock(RecipeSuggestionsDocument, {
    data: { recipeSuggestions: { edges } },
    match: vars => vars.homeId === homeId,
    maxUsageCount: Number.POSITIVE_INFINITY,
    ...options,
  });

const ids = (rows: RecipeRow[]) => shown(rows).map(item => item.id);

beforeEach(() => {
  useStore.setState({ selectedHomeId: null });
});

describe('useServerRecipeSuggestions per home', () => {
  it("asks for the selected home's ranking", async () => {
    useStore.setState({ selectedHomeId: 'home-a' });
    const homeA = homeRanking('home-a', [edge('r-a', 90)]);
    const { result } = renderSuggestions([homeA.mock]);

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    expect(homeA.fired[0]).toEqual({
      first: 20,
      today: '2026-10-14',
      homeId: 'home-a',
    });
  });

  it('asks for every pantry the user may view when no home is selected', async () => {
    const suggestions = suggestionsMock([edge('r-1', 50)]);
    const { result } = renderSuggestions([suggestions.mock]);

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    expect(suggestions.fired[0]?.homeId).toBeUndefined();
  });

  it("shows the new home's ranking after a switch, never the old one's meanwhile", async () => {
    useStore.setState({ selectedHomeId: 'home-a' });
    const homeA = homeRanking('home-a', [edge('r-a', 90)]);
    const homeB = homeRanking('home-b', [edge('r-b', 40)], { held: true });
    const { result } = renderSuggestions([homeA.mock, homeB.mock]);
    await waitFor(() =>
      expect(ids(result.current.rows)).toEqual(['recipe-r-a']),
    );

    act(() => {
      useStore.setState({ selectedHomeId: 'home-b' });
    });

    await waitFor(() => expect(homeB.fired).toHaveLength(1));
    expect(result.current.rows).toEqual([]);
    expect(result.current.loading).toBe(true);

    act(() => {
      homeB.release();
    });

    await waitFor(() =>
      expect(ids(result.current.rows)).toEqual(['recipe-r-b']),
    );
  });

  it("shows a home's own cached ranking when switching back offline", async () => {
    useStore.setState({ selectedHomeId: 'home-a' });
    const homeA = recordMock(RecipeSuggestionsDocument, {
      data: { recipeSuggestions: { edges: [edge('r-a', 90)] } },
      match: vars => vars.homeId === 'home-a',
      maxUsageCount: 1,
    });
    const homeAOffline = recordMock(RecipeSuggestionsDocument, {
      error: new Error('network down'),
      match: vars => vars.homeId === 'home-a',
      maxUsageCount: Number.POSITIVE_INFINITY,
    });
    const homeB = homeRanking('home-b', [edge('r-b', 40)]);
    const { result } = renderSuggestions([
      homeA.mock,
      homeAOffline.mock,
      homeB.mock,
    ]);
    await waitFor(() =>
      expect(ids(result.current.rows)).toEqual(['recipe-r-a']),
    );
    act(() => {
      useStore.setState({ selectedHomeId: 'home-b' });
    });
    await waitFor(() =>
      expect(ids(result.current.rows)).toEqual(['recipe-r-b']),
    );

    act(() => {
      useStore.setState({ selectedHomeId: 'home-a' });
    });

    await waitFor(() =>
      expect(ids(result.current.rows)).toEqual(['recipe-r-a']),
    );
    expect(result.current.unanswered).toBe(false);
  });

  it("keeps no other home's answer when the new home's ask fails", async () => {
    useStore.setState({ selectedHomeId: 'home-a' });
    const homeA = homeRanking('home-a', [edge('r-a', 90)]);
    const refused = recordMock(RecipeSuggestionsDocument, {
      error: new Error('not a member of this home'),
      match: vars => vars.homeId === 'home-gone',
    });
    const { result } = renderSuggestions([homeA.mock, refused.mock]);
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => {
      useStore.setState({ selectedHomeId: 'home-gone' });
    });

    await waitFor(() => expect(result.current.unanswered).toBe(true));
    expect(result.current.rows).toEqual([]);
  });
});

describe('useServerRecipeSuggestions', () => {
  it("lists the server's suggestions in its order, each opening its recipe", async () => {
    const { result } = renderSuggestions([
      suggestionsMock([edge('r-own', 80), edge('r-pub', 60)]).mock,
    ]);

    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    expect(shown(result.current.rows).map(item => item.id)).toEqual([
      'recipe-r-own',
      'recipe-r-pub',
    ]);
    expect(shown(result.current.rows)[0]?.badge?.text).toBe(
      '80% of its ingredients in your pantry',
    );
    expect(result.current.unanswered).toBe(false);
  });

  it("asks for one page, with the device's date", async () => {
    const suggestions = suggestionsMock([edge('r-1', 50)]);
    const { result } = renderSuggestions([suggestions.mock]);

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

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

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    expect(shown(result.current.rows)[0]?.subtitle).toContain(uses);
  });

  it('asks the server again on refresh', async () => {
    const suggestions = suggestionsMock([edge('r-1', 50)]);
    const { result } = renderSuggestions([suggestions.mock]);
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

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
    expect(result.current.rows).toEqual([]);
  });

  it('keeps its last answer when a later ask fails', async () => {
    const answered = recordMock(RecipeSuggestionsDocument, {
      data: { recipeSuggestions: { edges: [edge('r-1', 50)] } },
      maxUsageCount: 1,
    });
    const failed = recordMock(RecipeSuggestionsDocument, {
      error: new Error('network down'),
    });
    const { result } = renderSuggestions([answered.mock, failed.mock]);
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(failed.fired).toHaveLength(1);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.unanswered).toBe(false);
  });

  it('asks for nothing when switched off', () => {
    const suggestions = suggestionsMock([edge('r-1', 50)]);
    const { result } = renderSuggestions([suggestions.mock], false);

    expect(suggestions.fired).toEqual([]);
    expect(result.current).toMatchObject({
      rows: [],
      loading: false,
      unanswered: false,
    });
  });
});
