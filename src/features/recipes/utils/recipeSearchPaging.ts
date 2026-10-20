/**
 * One page of recipe search from both sources: the local connection pages by
 * cursor and Spoonacular by offset, so a page advances both and dedupes across
 * them, and the cursor state travels as one value.
 */

import { errorService } from '#/services/errorService';
import type { ApolloClient, TypedDocumentNode } from '@apollo/client';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import type { SearchRecipesQueryVariables } from '#features/recipes/graphql/recipe.generated';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';
import type { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  type RecipeFilters,
  SPOONACULAR_TO_DIET_ENUM,
  SPOONACULAR_TO_INTOLERANCE_ENUM,
  SPOONACULAR_TO_MEAL_TYPE_CATEGORY,
} from '#features/recipes/utils/recipeFilterMaps';
import {
  type RecipeRow,
  type SearchedRecipe,
  type SpoonacularRecipe,
  spoonacularRows,
  localRows,
} from '#features/recipes/utils/recipeRows';

/** The connection search pages through, as any caller's document selects it. */
export interface RecipeSearchData<TNode extends SearchedRecipe> {
  searchRecipes: {
    edges: ReadonlyArray<{ node: TNode }>;
    pageInfo: { endCursor?: string | null; hasNextPage: boolean };
  };
}

/** A caller's `searchRecipes` query: its cards' fields, search's variables. */
export type RecipeSearchDocument<TNode extends SearchedRecipe> =
  TypedDocumentNode<RecipeSearchData<TNode>, SearchRecipesQueryVariables>;

/** Why a search showed nothing; the caller says it in its own words. */
export type SearchFailure =
  | 'offline'
  | 'quotaExceeded'
  | 'rateLimited'
  | 'failed';

export type SearchOutcome =
  | { status: 'shown' }
  /** A newer search or a clear replaced it before it committed. */
  | { status: 'superseded' }
  | { status: 'failed'; failure: SearchFailure };

const SHOWN: SearchOutcome = { status: 'shown' };
const SUPERSEDED: SearchOutcome = { status: 'superseded' };

function failedSearch(error: unknown, label: string): SearchOutcome {
  const err = error as {
    isQuotaExceeded?: boolean;
    isRateLimitError?: boolean;
  };
  errorService.reportError(error, { operation: label });
  // Offline is a state, not a failure: the search surface shows its own
  // offline state rather than "search failed", which the reader cannot act on.
  if (isApiUnavailable(useStore.getState())) {
    return { status: 'failed', failure: 'offline' };
  }
  if (err.isQuotaExceeded)
    return { status: 'failed', failure: 'quotaExceeded' };
  if (err.isRateLimitError) return { status: 'failed', failure: 'rateLimited' };
  return { status: 'failed', failure: 'failed' };
}

/** Where a search commits, and whether it still may. */
export interface SearchCommits<TNode extends SearchedRecipe> {
  setLoading: (loading: boolean) => void;
  setPerformed: (performed: boolean) => void;
  setRows: (rows: RecipeRow<TNode>[]) => void;
  /** False once a newer search or a clear has replaced this one. */
  isCurrent: () => boolean;
}

export const SEARCH_FETCH_SIZE = 25;

export const normalizeTitle = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, ' ');

// Dedupe keys across sources and pages: `spoonacularIds` are external ids the
// backend has linked (its rows win), `titles` the normalized titles shown.
// Initial search and load-more share one set.
export interface SeenKeys {
  spoonacularIds: Set<string>;
  titles: Set<string>;
}

export function createSeenKeys(): SeenKeys {
  return { spoonacularIds: new Set(), titles: new Set() };
}

// Drops rows already shown: by Spoonacular id where a backend recipe is linked,
// else by normalized title, where the first-rendered local row wins. Mutates
// `seen` so the next page sees these keys.
export function dedupePageAgainstSeen<TNode extends SearchedRecipe>(
  localNodes: readonly TNode[],
  spoonacularResults: SpoonacularRecipe[],
  seen: SeenKeys,
): { localNodes: TNode[]; spoonacular: SpoonacularRecipe[] } {
  const dedupedLocal: TNode[] = [];
  for (const node of localNodes) {
    const titleKey = normalizeTitle(node.name);
    const idKey =
      node.externalSource === ExternalSource.Spoonacular && node.externalId
        ? node.externalId
        : null;
    // A local row already shown on an earlier page (same title, or same linked
    // Spoonacular id) is dropped instead of re-appended.
    if (
      seen.titles.has(titleKey) ||
      (idKey !== null && seen.spoonacularIds.has(idKey))
    ) {
      continue;
    }
    if (idKey !== null) seen.spoonacularIds.add(idKey);
    seen.titles.add(titleKey);
    dedupedLocal.push(node);
  }

  const dedupedSpoonacular: SpoonacularRecipe[] = [];
  for (const recipe of spoonacularResults) {
    const idKey = String(recipe.id);
    const titleKey = normalizeTitle(recipe.title);
    if (seen.spoonacularIds.has(idKey) || seen.titles.has(titleKey)) continue;
    seen.spoonacularIds.add(idKey);
    seen.titles.add(titleKey);
    dedupedSpoonacular.push(recipe);
  }

  return { localNodes: dedupedLocal, spoonacular: dedupedSpoonacular };
}

// Pagination cursors for one combined text search. `query`/`filters` are
// retained so load-more re-issues the same terms; the local cursor and
// Spoonacular offset/total drive the "is there more?" decision per source.
export interface SearchPagination {
  query: string;
  filters: RecipeFilters;
  localEndCursor: string | null;
  localHasNextPage: boolean;
  spoonacularOffset: number;
  spoonacularTotal: number;
  seen: SeenKeys;
}

export const EMPTY_PAGINATION: SearchPagination = {
  query: '',
  filters: { diet: [], intolerances: [], mealType: null, maxReadyTime: null },
  localEndCursor: null,
  localHasNextPage: false,
  spoonacularOffset: 0,
  spoonacularTotal: 0,
  seen: createSeenKeys(),
};

interface SpoonacularPage {
  results: SpoonacularRecipe[];
  total: number | null;
}

const EMPTY_SPOONACULAR_PAGE: SpoonacularPage = { results: [], total: null };

/**
 * One Spoonacular text-search page, from the cache when held. Every text search
 * comes here: the key omits the page size, so a writer with another size would
 * hand this one a short page. Throws on a failed fetch.
 */
export async function fetchSpoonacularTextPage(
  query: string,
  filters: RecipeFilters,
  offset: number,
  signal?: AbortSignal,
): Promise<SpoonacularPage> {
  const cacheKey = textSearchCacheKey(query, filters, offset);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);
  // A null total (entry persisted before the field existed) reads as unknown.
  if (cached) {
    return { results: cached.results, total: cached.totalResults ?? null };
  }
  const data = await spoonacularService.searchRecipesWithInfo(
    {
      query,
      number: SEARCH_FETCH_SIZE,
      offset,
      ...(filters.diet.length > 0 && { diet: filters.diet.join(',') }),
      ...(filters.intolerances.length > 0 && {
        intolerances: filters.intolerances.join(','),
      }),
      ...(filters.mealType && { type: filters.mealType }),
      ...(filters.maxReadyTime && { maxReadyTime: filters.maxReadyTime }),
    },
    signal,
  );
  cacheStore.setCached(cacheKey, data.results, undefined, data.totalResults);
  return { results: data.results, total: data.totalResults };
}

// One combined page of results plus the advanced cursor state — the shared
// unit of work for both the initial search and load-more.
export interface SearchPageResult<TNode extends SearchedRecipe> {
  rows: RecipeRow<TNode>[];
  localEndCursor: string | null;
  localHasNextPage: boolean;
  // How many rows this page actually fetched (advances the offset).
  spoonacularResultCount: number;
  // Spoonacular's full catalog count for the query — null when the page came
  // from the offline cache (the cache doesn't store the total). A null total
  // on load-more leaves the prior total untouched.
  spoonacularTotal: number | null;
  spoonacularError: unknown;
}

// ONE page from both sources, deduped against `seen` (mutated), with advanced
// cursors; initial search and load-more share it. A local failure degrades to
// null and a Spoonacular error is captured, so either source alone still pages.
export async function fetchRecipeSearchPage<TNode extends SearchedRecipe>(
  document: RecipeSearchDocument<TNode>,
  query: string,
  filters: RecipeFilters,
  client: ApolloClient,
  localAfter: string | null,
  fetchLocal: boolean,
  spoonacularOffset: number,
  fetchSpoonacular: boolean,
  seen: SeenKeys,
): Promise<SearchPageResult<TNode>> {
  // `activeFilters` map back to the API's enums (unmapped values drop), so both
  // sources filter alike. Skipped once local has no more pages: a null cursor
  // re-fetches page 1 and double-appends it.
  const localDiets = filters.diet
    .map(d => SPOONACULAR_TO_DIET_ENUM[d])
    .filter((d): d is Diet => Boolean(d));
  const localIntolerances = filters.intolerances
    .map(i => SPOONACULAR_TO_INTOLERANCE_ENUM[i])
    .filter((i): i is Intolerance => Boolean(i));
  const localCategory = filters.mealType
    ? SPOONACULAR_TO_MEAL_TYPE_CATEGORY[filters.mealType]
    : undefined;
  const searchLocalRecipes =
    async (): Promise<RecipeSearchData<TNode> | null> => {
      try {
        const result = await client.query({
          query: document,
          variables: {
            query,
            first: SEARCH_FETCH_SIZE,
            ...(localAfter && { after: localAfter }),
            ...(localDiets.length > 0 && { diets: localDiets }),
            ...(localIntolerances.length > 0 && {
              intolerances: localIntolerances,
            }),
            ...(filters.maxReadyTime && {
              maxReadyTime: filters.maxReadyTime,
            }),
            ...(localCategory && { category: localCategory }),
          },
          fetchPolicy: 'network-only',
        });
        return result.data ?? null;
      } catch {
        // Null lets the Spoonacular source below still render; the alert fires
        // only when the combined list would otherwise be empty.
        return null;
      }
    };

  const localPromise: Promise<RecipeSearchData<TNode> | null> = fetchLocal
    ? searchLocalRecipes()
    : Promise.resolve(null);

  // Errors are captured, not alerted, so the local source can still render;
  // the alert fires only when the combined list would otherwise be empty.
  let spoonacularError: unknown = null;
  const spoonacularPromise = !fetchSpoonacular
    ? Promise.resolve(EMPTY_SPOONACULAR_PAGE)
    : fetchSpoonacularTextPage(query, filters, spoonacularOffset).catch(
        (error: unknown) => {
          spoonacularError = error;
          return EMPTY_SPOONACULAR_PAGE;
        },
      );

  const [localData, spoonacular] = await Promise.all([
    localPromise,
    spoonacularPromise,
  ]);

  const rawLocalNodes =
    localData?.searchRecipes.edges.map(edge => edge.node) ?? [];
  const localPageInfo = localData?.searchRecipes.pageInfo;
  const spoonacularResults = spoonacular.results;

  // Index this page's live Spoonacular results BEFORE dedupe so a kept local
  // row can still borrow time + likes from a twin that gets deduped out
  // (matched by external id, then title).
  const spoonacularById = new Map<string, SpoonacularRecipe>();
  const spoonacularByTitle = new Map<string, SpoonacularRecipe>();
  for (const recipe of spoonacularResults) {
    spoonacularById.set(String(recipe.id), recipe);
    const titleKey = normalizeTitle(recipe.title);
    if (!spoonacularByTitle.has(titleKey))
      spoonacularByTitle.set(titleKey, recipe);
  }
  const enrichmentFor = (node: TNode): SpoonacularRecipe | undefined => {
    if (node.externalSource === ExternalSource.Spoonacular && node.externalId) {
      const byId = spoonacularById.get(node.externalId);
      if (byId) return byId;
    }
    return spoonacularByTitle.get(normalizeTitle(node.name));
  };

  // Dedupe both sources against everything already shown (local first, so a
  // backend row wins a title collision).
  const { localNodes, spoonacular: dedupedSpoonacular } = dedupePageAgainstSeen(
    rawLocalNodes,
    spoonacularResults,
    seen,
  );

  const rows = [
    ...localRows(localNodes, enrichmentFor),
    ...spoonacularRows<TNode>(dedupedSpoonacular),
  ];

  return {
    rows,
    localEndCursor: localPageInfo?.endCursor ?? null,
    localHasNextPage: localPageInfo?.hasNextPage ?? false,
    spoonacularResultCount: spoonacularResults.length,
    spoonacularTotal: spoonacular.total,
    spoonacularError,
  };
}

export async function executeRecipeTextSearch<TNode extends SearchedRecipe>(
  document: RecipeSearchDocument<TNode>,
  query: string,
  filters: RecipeFilters,
  client: ApolloClient,
  {
    setLoading,
    setPerformed,
    setRows,
    setPagination,
    isCurrent,
  }: SearchCommits<TNode> & {
    setPagination: (pagination: SearchPagination) => void;
  },
): Promise<SearchOutcome> {
  setLoading(true);
  setPerformed(true);

  const seen = createSeenKeys();
  const page = await fetchRecipeSearchPage(
    document,
    query,
    filters,
    client,
    null,
    true,
    0,
    true,
    seen,
  );

  // A newer search fired mid-flight: discard this response whole, so it cannot
  // clobber the newer results, cursors, error or loading flag.
  if (!isCurrent()) return SUPERSEDED;

  setRows(page.rows);
  setPagination({
    query,
    filters,
    localEndCursor: page.localEndCursor,
    localHasNextPage: page.localHasNextPage,
    // A null total comes only from an entry persisted before totals were
    // cached; the count received stands in, and paging recovers on the next
    // uncached search.
    spoonacularOffset: page.spoonacularResultCount,
    spoonacularTotal: page.spoonacularTotal ?? page.spoonacularResultCount,
    seen,
  });

  let outcome = SHOWN;
  if (page.spoonacularError) {
    if (page.rows.length === 0) {
      outcome = failedSearch(page.spoonacularError, 'Search error');
    } else {
      // Local results are on screen — degrade silently.
      errorService.reportError(page.spoonacularError, {
        operation: 'searchRecipesSpoonacularDegraded',
      });
    }
  }

  setLoading(false);
  return outcome;
}

// The next page from each source with results left, deduped against
// `pagination.seen`; the CALLER commits it, only if the search was not replaced
// mid-flight. Failures never wipe shown results.
export async function executeRecipeLoadMore<TNode extends SearchedRecipe>(
  document: RecipeSearchDocument<TNode>,
  pagination: SearchPagination,
  client: ApolloClient,
): Promise<{
  rows: RecipeRow<TNode>[];
  nextPagination: SearchPagination;
} | null> {
  const { query, filters, seen } = pagination;

  const fetchLocal = pagination.localHasNextPage;
  const spoonacularHasMore =
    pagination.spoonacularOffset < pagination.spoonacularTotal;

  // Nothing left on either source — guard against an accidental duplicate
  // append.
  if (!fetchLocal && !spoonacularHasMore) return null;

  const page = await fetchRecipeSearchPage(
    document,
    query,
    filters,
    client,
    pagination.localEndCursor,
    fetchLocal,
    pagination.spoonacularOffset,
    spoonacularHasMore,
    seen,
  );

  // An empty Spoonacular page is the plan's paging cap (or a 402) though
  // `total` advertises more: freezing `total` at the offset stops the footer
  // re-firing the same empty page, since the offset grows by row count.
  const spoonacularExhausted =
    spoonacularHasMore && page.spoonacularResultCount === 0;

  if (page.spoonacularError) {
    // Already-shown results stay on screen; report and degrade silently.
    errorService.reportError(page.spoonacularError, {
      operation: 'searchRecipesLoadMoreDegraded',
    });
  }

  return {
    rows: page.rows,
    nextPagination: {
      ...pagination,
      // Only the queried source's cursor advances; the exhausted one is left as-is.
      localEndCursor: fetchLocal
        ? page.localEndCursor
        : pagination.localEndCursor,
      localHasNextPage: fetchLocal ? page.localHasNextPage : false,
      spoonacularOffset: spoonacularHasMore
        ? pagination.spoonacularOffset + page.spoonacularResultCount
        : pagination.spoonacularOffset,
      // A null total (cache hit on the new page) keeps the prior known total.
      spoonacularTotal: spoonacularExhausted
        ? pagination.spoonacularOffset
        : page.spoonacularTotal ?? pagination.spoonacularTotal,
      seen,
    },
  };
}

export async function executeRecipeIngredientSearch<
  TNode extends SearchedRecipe,
>(
  ingredientString: string,
  { setLoading, setPerformed, setRows, isCurrent }: SearchCommits<TNode>,
): Promise<SearchOutcome> {
  setLoading(true);
  setPerformed(true);

  // Check cache first
  const cacheKey = ingredientCacheKey(ingredientString);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    // A newer search (text or ingredient) was fired mid-flight — discard so this
    // stale response can't clobber the fresher results or clear the loading flag
    // the newer search now owns. Mirrors executeRecipeTextSearch's guard.
    if (!isCurrent()) return SUPERSEDED;
    setRows(spoonacularRows(cached.results));
    setLoading(false);
    return SHOWN;
  }

  let outcome = SHOWN;
  try {
    // Note: findByIngredients API does NOT support diet/intolerance/mealType filters
    const results = await spoonacularService.searchRecipesByIngredients({
      ingredients: ingredientString,
      number: SEARCH_FETCH_SIZE,
      ranking: 1,
      ignorePantry: true,
    });
    // The results are valid for this ingredient key regardless of staleness,
    // so warm the cache unconditionally; only the visible commit is guarded.
    cacheStore.setCached(cacheKey, results);
    if (isCurrent()) {
      setRows(spoonacularRows(results));
    } else {
      outcome = SUPERSEDED;
    }
  } catch (error) {
    outcome = failedSearch(error, 'Ingredient search error');
  }

  if (isCurrent()) setLoading(false);
  return outcome;
}
