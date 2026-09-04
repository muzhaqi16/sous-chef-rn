import { errorService } from '#/services/errorService';
import type { ApolloClient } from '@apollo/client';
import { alertService } from '#/services/alertService';
import { t as tGlobal } from '#/i18n';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import {
  SearchRecipesDocument,
  type SearchRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';
import {
  ExternalSource,
  Diet,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import {
  type RecipeFilters,
  SPOONACULAR_TO_DIET_ENUM,
  SPOONACULAR_TO_INTOLERANCE_ENUM,
} from '#features/recipes/utils/recipeFilterMaps';
import {
  type DisplayItem,
  type LocalRecipeNode,
  type SpoonacularRecipe,
  toSpoonacularDisplayItems,
  toLocalDisplayItems,
} from '#features/recipes/utils/recipeDisplayTransforms';

/**
 * One page of recipe search, from two sources at once. The local connection
 * pages by cursor and Spoonacular by offset, so a combined page has to advance
 * both and dedupe what the two return — which is why the cursor state travels
 * as one value rather than as separate pieces of hook state.
 */
export function handleSearchError(error: unknown, label: string): void {
  const err = error as {
    isQuotaExceeded?: boolean;
    isRateLimitError?: boolean;
  };
  errorService.reportError(error, { operation: label });
  if (err.isQuotaExceeded) {
    alertService.alert(
      tGlobal('recipes.apiLimitTitle'),
      tGlobal('recipes.apiLimitMessage'),
    );
  } else if (err.isRateLimitError) {
    alertService.alert(
      tGlobal('recipes.rateLimitTitle'),
      tGlobal('recipes.rateLimitMessage'),
    );
  } else {
    alertService.alert(
      tGlobal('errors.searchFailed'),
      tGlobal('recipes.searchErrorMessage'),
    );
  }
}

export const SEARCH_FETCH_SIZE = 25;

export const normalizeTitle = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, ' ');

// Identity keys for the cross-source / cross-page dedupe. `spoonacularIds` are
// the external ids the backend has linked (its rows win), and `titles` are the
// normalized titles already shown. Both initial search and load-more feed the
// same set so a recipe surfaced on an earlier page is never shown twice on a
// later one.
export interface SeenKeys {
  spoonacularIds: Set<string>;
  titles: Set<string>;
}

export function createSeenKeys(): SeenKeys {
  return { spoonacularIds: new Set(), titles: new Set() };
}

// Drops rows colliding with something already shown, across BOTH sources and
// pages: by Spoonacular id where a backend recipe is linked, and by normalized
// title for the rest. Local rows render first, so a backend copy wins a title
// collision. `seen` is mutated in place so the next page sees these keys.
export function dedupePageAgainstSeen(
  localNodes: LocalRecipeNode[],
  spoonacularResults: SpoonacularRecipe[],
  seen: SeenKeys,
): { localNodes: LocalRecipeNode[]; spoonacular: SpoonacularRecipe[] } {
  const dedupedLocal: LocalRecipeNode[] = [];
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

// One combined page of results plus the advanced cursor state — the shared
// unit of work for both the initial search and load-more.
export interface SearchPageResult {
  items: DisplayItem[];
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

// Fetch ONE page from both sources, combine + dedupe (against `seen`, which is
// mutated), and return the new display items + advanced source cursors. Shared
// by the initial search (offset 0, no cursor) and load-more (next offset +
// cursor). Local failures resolve to null and degrade silently; Spoonacular
// errors are captured, not thrown, so a one-source failure still returns the
// other source's page.
export async function fetchRecipeSearchPage(
  query: string,
  filters: RecipeFilters,
  client: ApolloClient,
  localAfter: string | null,
  fetchLocal: boolean,
  spoonacularOffset: number,
  fetchSpoonacular: boolean,
  seen: SeenKeys,
): Promise<SearchPageResult> {
  // `activeFilters` holds Spoonacular strings; map them back to the
  // Diet/Intolerance enums the GraphQL API takes (unmapped values drop), so
  // both sources filter alike. Skipped when local has no more pages — a null
  // cursor re-fetches page 1 and double-appends it.
  const localDiets = filters.diet
    .map(d => SPOONACULAR_TO_DIET_ENUM[d])
    .filter((d): d is Diet => Boolean(d));
  const localIntolerances = filters.intolerances
    .map(i => SPOONACULAR_TO_INTOLERANCE_ENUM[i])
    .filter((i): i is Intolerance => Boolean(i));
  const searchLocalRecipes = async (): Promise<SearchRecipesQuery | null> => {
    try {
      const result = await client.query({
        query: SearchRecipesDocument,
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

  const localPromise: Promise<SearchRecipesQuery | null> = fetchLocal
    ? searchLocalRecipes()
    : Promise.resolve(null);

  // Spoonacular search — served from the 24h cache when available. The cache
  // key includes the offset so a later page isn't served the first page's
  // results. Errors are captured (not alerted) so the local source can still
  // render; the alert only fires when the combined list would otherwise be
  // empty. Skipped when the Spoonacular source is exhausted.
  let spoonacularError: unknown = null;
  const cacheKey = textSearchCacheKey(query, filters, spoonacularOffset);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = fetchSpoonacular ? cacheStore.getCached(cacheKey) : null;

  const spoonacularPromise: Promise<{
    results: SpoonacularRecipe[];
    total: number | null;
  }> = !fetchSpoonacular
    ? Promise.resolve({ results: [], total: null })
    : cached
    ? // A cache hit keeps the fetch-time total so paging still works — a null
      // total (entry persisted before the field existed) reads as "unknown".
      Promise.resolve({
        results: cached.results,
        total: cached.totalResults ?? null,
      })
    : (async () => {
        let results: SpoonacularRecipe[] = [];
        let total: number | null = null;
        const searchParams = {
          query,
          number: SEARCH_FETCH_SIZE,
          offset: spoonacularOffset,
          ...(filters.diet.length > 0 && { diet: filters.diet.join(',') }),
          ...(filters.intolerances.length > 0 && {
            intolerances: filters.intolerances.join(','),
          }),
          ...(filters.mealType && { type: filters.mealType }),
          ...(filters.maxReadyTime && {
            maxReadyTime: filters.maxReadyTime,
          }),
        };
        try {
          const data = await spoonacularService.searchRecipesWithInfo(
            searchParams,
          );
          results = data.results || [];
          total = data.totalResults;
          cacheStore.setCached(cacheKey, results, undefined, total);
        } catch (error) {
          spoonacularError = error;
        }
        return { results, total };
      })();

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
  const enrichmentFor = (
    node: LocalRecipeNode,
  ): SpoonacularRecipe | undefined => {
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

  const items = [
    ...toLocalDisplayItems(localNodes, enrichmentFor),
    ...toSpoonacularDisplayItems(dedupedSpoonacular),
  ];

  return {
    items,
    localEndCursor: localPageInfo?.endCursor ?? null,
    localHasNextPage: localPageInfo?.hasNextPage ?? false,
    spoonacularResultCount: spoonacularResults.length,
    spoonacularTotal: spoonacular.total,
    spoonacularError,
  };
}

export async function executeRecipeTextSearch(
  query: string,
  filters: RecipeFilters,
  client: ApolloClient,
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setDisplayResults: (v: DisplayItem[]) => void,
  setPagination: (p: SearchPagination) => void,
  shouldCommit: () => boolean,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  const seen = createSeenKeys();
  const page = await fetchRecipeSearchPage(
    query,
    filters,
    client,
    null,
    true,
    0,
    true,
    seen,
  );

  // A newer search was fired while this one was in flight — discard this
  // response entirely so it can't clobber the fresher results, commit stale
  // pagination cursors, surface an irrelevant error, or clear the loading flag
  // the newer search now owns. Mirrors the load-more path's mid-flight guard.
  if (!shouldCommit()) return;

  setDisplayResults(page.items);
  setPagination({
    query,
    filters,
    localEndCursor: page.localEndCursor,
    localHasNextPage: page.localHasNextPage,
    // The next page starts where this one ended. The total drives the
    // "is there more Spoonacular?" check (offset < total). Cache hits carry
    // the fetch-time total; a null total only remains for entries persisted
    // before the total was cached — treat the count we got as the total then
    // (paging recovers on the next uncached search).
    spoonacularOffset: page.spoonacularResultCount,
    spoonacularTotal: page.spoonacularTotal ?? page.spoonacularResultCount,
    seen,
  });

  if (page.spoonacularError) {
    if (page.items.length === 0) {
      handleSearchError(page.spoonacularError, 'Search error');
    } else {
      // Local results are on screen — degrade silently.
      errorService.reportError(page.spoonacularError, {
        operation: 'searchRecipesSpoonacularDegraded',
      });
    }
  }

  setLoading(false);
}

// Fetches the next page from whichever source still has results, dedupes
// against `pagination`'s shared `seen` keys, and returns rows plus advanced
// cursors — the CALLER commits them, and only if the search was not replaced
// mid-flight. An exhausted source is skipped so its rows are not re-appended.
// Failures never wipe already-shown results.
export async function executeRecipeLoadMore(
  pagination: SearchPagination,
  client: ApolloClient,
): Promise<{ items: DisplayItem[]; nextPagination: SearchPagination } | null> {
  const { query, filters, seen } = pagination;

  const fetchLocal = pagination.localHasNextPage;
  const spoonacularHasMore =
    pagination.spoonacularOffset < pagination.spoonacularTotal;

  // Nothing left on either source — guard against an accidental duplicate
  // append.
  if (!fetchLocal && !spoonacularHasMore) return null;

  const page = await fetchRecipeSearchPage(
    query,
    filters,
    client,
    pagination.localEndCursor,
    fetchLocal,
    pagination.spoonacularOffset,
    spoonacularHasMore,
    seen,
  );

  // A Spoonacular page we asked for that came back empty means we've hit the
  // plan's paging cap (or a 402) even though `total` still advertises more
  // results. Freeze `total` at the current offset so `offset < total` flips
  // false — otherwise the offset can't advance (it grows by the row count,
  // which is 0 here) and the footer re-fires the same empty page forever.
  const spoonacularExhausted =
    spoonacularHasMore && page.spoonacularResultCount === 0;

  if (page.spoonacularError) {
    // Already-shown results stay on screen; report and degrade silently.
    errorService.reportError(page.spoonacularError, {
      operation: 'searchRecipesLoadMoreDegraded',
    });
  }

  return {
    items: page.items,
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

export async function executeRecipeIngredientSearch(
  ingredientString: string,
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setDisplayResults: (v: DisplayItem[]) => void,
  shouldCommit: () => boolean,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  // Check cache first
  const cacheKey = ingredientCacheKey(ingredientString);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    // A newer search (text or ingredient) was fired mid-flight — discard so this
    // stale response can't clobber the fresher results or clear the loading flag
    // the newer search now owns. Mirrors executeRecipeTextSearch's guard.
    if (!shouldCommit()) return;
    setDisplayResults(toSpoonacularDisplayItems(cached.results));
    setLoading(false);
    return;
  }

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
    if (shouldCommit()) {
      setDisplayResults(toSpoonacularDisplayItems(results));
    }
  } catch (error) {
    handleSearchError(error, 'Ingredient search error');
  }

  if (shouldCommit()) setLoading(false);
}
