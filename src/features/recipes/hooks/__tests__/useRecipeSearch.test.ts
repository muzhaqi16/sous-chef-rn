import { act } from '@testing-library/react-native';
import { gql, type TypedDocumentNode } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import { useStore } from '#store';
import {
  Difficulty,
  type PageInfo,
  type Recipe,
} from '#/graphql/generated/schemaTypes';
import type { SearchRecipesQueryVariables } from '#features/recipes/graphql/recipe.generated';
import { DEFAULT_FILTERS } from '#features/recipes/utils/recipeFilterMaps';
import type {
  RecipeSearchData,
  SearchOutcome,
} from '#features/recipes/utils/recipeSearchPaging';
import { useRecipeCacheStore } from '#features/recipes/store/useRecipeCacheStore';
import { useRecipeSearch } from '../useRecipeSearch';

jest.mock('#/services/spoonacular/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipesWithInfo: jest.fn(),
    searchRecipesByIngredients: jest.fn(),
  },
}));

// Another UI's search: its cards read `difficulty`, which the mobile list's
// document does not select.
type CardNode = Pick<
  Recipe,
  'id' | 'name' | 'externalSource' | 'externalId' | 'difficulty'
>;
const CardSearch: TypedDocumentNode<
  RecipeSearchData<CardNode>,
  SearchRecipesQueryVariables
> = gql`
  query CardSearchProbe(
    $query: String!
    $first: Int
    $after: String
    $diets: [Diet!]
    $intolerances: [Intolerance!]
    $maxReadyTime: Int
    $category: RecipeCategory
  ) {
    searchRecipes(
      query: $query
      first: $first
      after: $after
      filters: {
        diets: $diets
        intolerances: $intolerances
        maxReadyTime: $maxReadyTime
        category: $category
      }
    ) {
      edges {
        node {
          id
          name
          externalSource
          externalId
          difficulty
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const renderSearch = (operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useRecipeSearch(CardSearch), { operationMocks });

beforeEach(() => {
  useRecipeCacheStore.getState().clearAllCache();
  useStore.setState({ isOnline: true, apiReachable: true });
  jest
    .mocked(spoonacularService.searchRecipesWithInfo)
    .mockResolvedValue({ results: [], offset: 0, number: 0, totalResults: 0 });
});

describe('useRecipeSearch', () => {
  it("pages the caller's own document, so its rows carry its cards' fields", async () => {
    const search = recordMock(CardSearch, {
      data: {
        searchRecipes: {
          edges: [
            {
              node: {
                id: 'r-1',
                name: 'Lentil stew',
                externalSource: null,
                externalId: null,
                difficulty: Difficulty.Easy,
              },
            },
          ],
          pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
        },
      },
    });
    const { result } = renderSearch([search.mock]);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.search('stew', DEFAULT_FILTERS);
    });

    expect(outcome).toEqual({ status: 'shown' });
    expect(search.fired).toEqual([{ query: 'stew', first: 25 }]);
    const [row] = result.current.rows;
    expect(row?.source === 'local' && row.node.difficulty).toBe(
      Difficulty.Easy,
    );
    expect(result.current.hasMore).toBe(true);
  });

  it('reports a failed search as its outcome, and alerts nothing', async () => {
    const search = recordMock(CardSearch, {
      data: {
        searchRecipes: {
          edges: [],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    });
    jest
      .mocked(spoonacularService.searchRecipesWithInfo)
      .mockRejectedValue(
        Object.assign(new Error('quota'), { isQuotaExceeded: true }),
      );
    const { result } = renderSearch([search.mock]);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.search('stew', DEFAULT_FILTERS);
    });

    expect(outcome).toEqual({ status: 'failed', failure: 'quotaExceeded' });
    expect(result.current.loading).toBe(false);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('reports a failed local search, which resolves rather than throws', async () => {
    const report = jest
      .spyOn(errorService, 'reportError')
      .mockImplementation(() => {});
    const search = recordMock(CardSearch, { error: new Error('network down') });
    const { result } = renderSearch([search.mock]);

    await act(async () => {
      await result.current.search('stew', DEFAULT_FILTERS);
    });

    expect(report).toHaveBeenCalledWith(expect.anything(), {
      operation: 'searchRecipesLocal',
    });
    report.mockRestore();
  });
});

// A caller's document must select every field search reads; the compiler
// refuses one that does not, rather than search quietly degrading.
type CallerSearch<TNode, TPageInfo> = TypedDocumentNode<
  {
    searchRecipes: {
      edges: ReadonlyArray<{ node: TNode }>;
      pageInfo: TPageInfo;
    };
  },
  SearchRecipesQueryVariables
>;
type FullPageInfo = Pick<PageInfo, 'endCursor' | 'hasNextPage'>;

it('refuses a document that omits a field search reads', () => {
  type Accepted = Parameters<typeof useRecipeSearch>[0];
  const omitsExternalId = CardSearch as unknown as CallerSearch<
    Omit<CardNode, 'externalId'>,
    FullPageInfo
  >;
  const omitsEndCursor = CardSearch as unknown as CallerSearch<
    CardNode,
    Pick<PageInfo, 'hasNextPage'>
  >;

  expect<Accepted>(CardSearch).toBeDefined();
  // @ts-expect-error without `externalId`, dedupe falls back to the title alone
  expect<Accepted>(omitsExternalId).toBeDefined();
  // @ts-expect-error without `endCursor`, load-more refetches the first page
  expect<Accepted>(omitsEndCursor).toBeDefined();
});
