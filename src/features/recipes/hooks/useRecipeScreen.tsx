import { useRef, useState } from 'react';
import { errorService } from '#/services/errorService';

import { useTranslation } from '#/i18n';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { alertService } from '#/services/alertService';
import { t as tGlobal } from '#/i18n';
import { useDeferredSearch } from '#hooks/performance/useDeferredSearch';
import { pantryItemSearch } from '#utils/searchUtils';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import { useRecipeDiscovery } from '#features/recipes/hooks/useRecipeDiscovery';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecipeFilters } from '#features/recipes/hooks/useRecipeFilters';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import {
  SearchRecipesDocument,
  type SearchRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';
import { useUserId } from '#store/useAppStore';
import type { IconName } from '#/utils/iconUtils';
import {
  ExternalSource,
  Diet,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import {
  type RecipeFilters,
  DIET_ENUM_TO_SPOONACULAR,
  INTOLERANCE_ENUM_TO_SPOONACULAR,
  SPOONACULAR_TO_DIET_ENUM,
  SPOONACULAR_TO_INTOLERANCE_ENUM,
} from '#features/recipes/utils/recipeFilterMaps';
import { isLifestyleDiet } from '#/constants/dietary';
import {
  type DisplayItem,
  type LocalRecipeNode,
  type SpoonacularRecipe,
  toSpoonacularDisplayItems,
  toLocalDisplayItems,
} from '#features/recipes/utils/recipeDisplayTransforms';

// ── Module-level search helpers (React Compiler safe) ──

function handleSearchError(error: unknown, label: string): void {
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

const SEARCH_FETCH_SIZE = 25;

const normalizeTitle = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, ' ');

// Identity keys for the cross-source / cross-page dedupe. `spoonacularIds` are
// the external ids the backend has linked (its rows win), and `titles` are the
// normalized titles already shown. Both initial search and load-more feed the
// same set so a recipe surfaced on an earlier page is never shown twice on a
// later one.
interface SeenKeys {
  spoonacularIds: Set<string>;
  titles: Set<string>;
}

function createSeenKeys(): SeenKeys {
  return { spoonacularIds: new Set(), titles: new Set() };
}

// Drop a page's rows that collide with something already shown — across BOTH
// sources and across pages. Two guards: (1) by Spoonacular id when a backend
// recipe is linked (viewed external recipes are upserted server-side); (2) by
// normalized title, which catches the same recipe surfaced from both sources
// (or a later local page) without an external-id link. Local backend rows
// render first, so a backend copy is the one kept when a title appears on both
// sides. `seen` is mutated in place so the next page sees these keys too.
function dedupePageAgainstSeen(
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
interface SearchPagination {
  query: string;
  filters: RecipeFilters;
  localEndCursor: string | null;
  localHasNextPage: boolean;
  spoonacularOffset: number;
  spoonacularTotal: number;
  seen: SeenKeys;
}

const EMPTY_PAGINATION: SearchPagination = {
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
interface SearchPageResult {
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
async function fetchRecipeSearchPage(
  query: string,
  filters: RecipeFilters,
  client: ApolloClient,
  localAfter: string | null,
  fetchLocal: boolean,
  spoonacularOffset: number,
  fetchSpoonacular: boolean,
  seen: SeenKeys,
): Promise<SearchPageResult> {
  // Local API search — the user's own recipes. `searchRecipes` accepts the
  // same diet/intolerance/maxReadyTime filters as Spoonacular, so both sources
  // stay consistent under active filters. `activeFilters` stores Spoonacular
  // strings; map them back to Diet/Intolerance enums for the GraphQL API
  // (unmapped values are dropped). Skipped entirely when the local source has
  // no more pages — re-querying with a null cursor would re-fetch page 1 and
  // double-append its rows.
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

async function executeRecipeTextSearch(
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

// Fetch the NEXT page from whichever source still has results, dedupe the new
// rows against everything already shown (via the shared `seen` keys carried in
// `pagination`), and return the rows plus advanced cursors — the CALLER commits
// them (atomically, and only if the search wasn't replaced mid-flight). Each
// source is queried only when it reports more (`localHasNextPage`,
// `offset < total`); the exhausted one is skipped by the `fetchLocal` /
// `fetchSpoonacular` flags so it isn't re-fetched and its rows re-appended.
// Local failures degrade silently; a Spoonacular error on load-more is reported
// but never wipes already-shown results.
async function executeRecipeLoadMore(
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

async function executeRecipeIngredientSearch(
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

// ── Facade hook ──

export function useRecipeScreen() {
  const { t } = useTranslation();

  // ── User ──
  const userId = useUserId();

  // Apollo client for the imperative local-API search in executeRecipeTextSearch
  const client = useApolloClient();

  // Monotonic token that supersedes in-flight text searches. Every fresh search
  // (new query, filter re-run, refresh) bumps it and captures the value; a
  // search only commits its results if its captured value is still current.
  const searchGenerationRef = useRef(0);

  // ── Dietary profile (for filter defaults + discovery tags) ──
  const { profile: dietaryProfile } = useDietaryProfile();

  // Reconcile the profile's diet restrictions into the single-lifestyle +
  // stackable-constraints model: keep at most one lifestyle diet (the first,
  // deterministic) plus every constraint diet, as Spoonacular-format strings.
  // Shared by discovery tags and the search filter seeding so the two agree.
  const profileDietRestrictions = (dietaryProfile?.restrictions ?? []).filter(
    (r): r is typeof r & { diet: Diet } => Boolean(r.diet),
  );
  const firstLifestyleDiet = profileDietRestrictions.find(r =>
    isLifestyleDiet(r.diet),
  );
  const reconciledDietValues = [
    ...(firstLifestyleDiet ? [firstLifestyleDiet] : []),
    ...profileDietRestrictions.filter(r => !isLifestyleDiet(r.diet)),
  ].map(r => DIET_ENUM_TO_SPOONACULAR[r.diet] ?? r.diet.toLowerCase());

  // Discovery (random recipe API) takes a comma-separated tag string (AND).
  const dietaryTags =
    reconciledDietValues.length > 0
      ? reconciledDietValues.join(',')
      : undefined;

  // ── Discovery (includes pantry data) ──
  const discovery = useRecipeDiscovery(dietaryTags);

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  // Results and their pagination cursors live in ONE state atom because they
  // advance together: the pagination carries the local connection cursor, the
  // Spoonacular offset/total, and the dedupe keys for exactly the rows shown.
  // A single atom lets a resolved load-more commit rows + cursors atomically —
  // and lets it detect (via pagination identity) that a new search or clear
  // replaced the state while the page was in flight, so the stale page is
  // dropped instead of corrupting the new query's list.
  const [searchData, setSearchData] = useState<{
    items: DisplayItem[];
    pagination: SearchPagination;
  }>({ items: [], pagination: EMPTY_PAGINATION });
  const searchResults = searchData.items;
  const searchPagination = searchData.pagination;
  // Guards against overlapping load-more calls (onEndReached can fire several
  // times before the next page resolves) and re-appending the same page.
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );

  // ── Ingredient search (local filtering for bottom sheet) ──
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');

  const { results: filteredPantryItems } = useDeferredSearch({
    items: discovery.pantryItems,
    searchQuery: ingredientSearchQuery,
    searchFn: pantryItemSearch,
  });

  const resetIngredientSearch = () => {
    setIngredientSearchQuery('');
  };

  // Results arrive pre-transformed into DisplayItems (see the recipeDisplay
  // transforms). A fresh search replaces the list and resets pagination (the
  // cursors come from executeRecipeTextSearch via setSearchPagination).
  const setDisplayResults = (displayItems: DisplayItem[]) => {
    setSearchData(prev => ({ ...prev, items: displayItems }));
  };

  const setSearchPagination = (pagination: SearchPagination) => {
    setSearchData(prev => ({ ...prev, pagination }));
  };

  // Re-run the current search with an explicit filter set (state updates are
  // async, so the caller passes the next filters rather than reading state).
  const rerunSearchWithFilters = async (nextFilters: RecipeFilters) => {
    if (!searchPerformed || !searchQuery.trim()) return;
    const generation = (searchGenerationRef.current += 1);
    await executeRecipeTextSearch(
      searchQuery,
      nextFilters,
      client,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResults,
      setSearchPagination,
      () => generation === searchGenerationRef.current,
    );
  };

  // ── Filters ──
  // Normalize the dietary profile's Diet/Intolerance enums into the
  // Spoonacular-format strings RecipeFilters stores, via the shared forward
  // maps (single source of truth). useRecipeFilters owns the state + mutators
  // and seeds itself from this the first time it arrives carrying data.
  const profileFilters: RecipeFilters | null = dietaryProfile
    ? {
        diet: reconciledDietValues,
        intolerances: (dietaryProfile.restrictions ?? [])
          .filter((r): r is typeof r & { intolerance: Intolerance } =>
            Boolean(r.intolerance),
          )
          .map(
            r =>
              INTOLERANCE_ENUM_TO_SPOONACULAR[r.intolerance] ??
              r.intolerance.toLowerCase(),
          ),
        mealType: null,
        maxReadyTime: dietaryProfile.maxCookTimeMinutes ?? null,
      }
    : null;

  const {
    activeFilters,
    setActiveFilters,
    activeFilterCount,
    clearFilters,
    removeFilter,
    clearFiltersAndSearchAgain,
  } = useRecipeFilters({
    profileFilters,
    onApplyFilters: rerunSearchWithFilters,
  });

  // ── Derived display state ──
  const showSearchResults = searchPerformed && searchResults.length > 0;
  const showDiscovery = !searchPerformed && discovery.items.length > 0;

  // Results are pre-transformed at data arrival (see setDisplayResults) — the
  // whole list is shown; pagination is real, not a client-side slice.
  const searchItems = showSearchResults ? searchResults : [];

  // More remains while EITHER source still has a page to fetch.
  const searchHasMore =
    showSearchResults &&
    (searchPagination.localHasNextPage ||
      searchPagination.spoonacularOffset < searchPagination.spoonacularTotal);

  // Fetch the next page from each source, dedupe the new rows against what's
  // already shown, and append. The loadingMore flag drops re-entrant calls
  // (onEndReached can fire repeatedly mid-fetch).
  const loadMoreSearch = async () => {
    if (!searchHasMore || searchLoadingMore) return;
    const captured = searchPagination;
    // executeWithLoadingState guarantees searchLoadingMore is cleared even if
    // the map/dedup step throws synchronously — otherwise a single throw would
    // leave the guard stuck and disable load-more permanently.
    await executeWithLoadingState(async () => {
      const outcome = await executeRecipeLoadMore(captured, client);
      if (!outcome) return;
      // Commit rows + cursors together, and only if the pagination is still
      // the one this fetch started from — a new search or clear mid-flight
      // replaced it, and this page belongs to the old query.
      setSearchData(prev =>
        prev.pagination === captured
          ? {
              items: [...prev.items, ...outcome.items],
              pagination: outcome.nextPagination,
            }
          : prev,
      );
    }, setSearchLoadingMore);
  };

  // DiscoveryItem already satisfies DisplayItem — no mapping needed
  const items: DisplayItem[] = showSearchResults
    ? searchItems
    : showDiscovery
    ? discovery.items
    : [];

  // Image preloading is handled by ItemList internally — no duplicate effect needed

  // ── Actions ──
  const toggleIngredient = (name: string) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const clearSelectedIngredients = () => {
    setSelectedIngredients(new Set());
  };

  const handleTextSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);

    const generation = (searchGenerationRef.current += 1);
    await executeRecipeTextSearch(
      query,
      activeFilters,
      client,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResults,
      setSearchPagination,
      () => generation === searchGenerationRef.current,
    );
  };

  const handleIngredientSearch = async () => {
    if (selectedIngredients.size === 0) {
      alertService.alert(
        tGlobal('recipes.noIngredientsSelectedTitle'),
        tGlobal('recipes.selectAtLeastOneIngredient'),
      );
      return;
    }

    const ingredientString = Array.from(selectedIngredients).join(',');

    // Ingredient results aren't driven by the text query, and filters don't
    // apply to them — clearing the query keeps the active-filter row and the
    // filtered empty state scoped to text searches only.
    setSearchQuery('');

    // Ingredient search is a single non-paginated Spoonacular call — clear any
    // text-search pagination so the list doesn't try to "load more".
    setSearchPagination(EMPTY_PAGINATION);

    // Join the generation scheme: bump so any in-flight text search is
    // superseded, and capture so a text search fired after this one supersedes
    // this ingredient search's commit.
    const generation = (searchGenerationRef.current += 1);
    await executeRecipeIngredientSearch(
      ingredientString,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResults,
      () => generation === searchGenerationRef.current,
    );
  };

  const handleRefresh = async () => {
    if (searchPerformed) {
      if (searchQuery.trim()) {
        const generation = (searchGenerationRef.current += 1);
        await executeRecipeTextSearch(
          searchQuery,
          activeFilters,
          client,
          setSearchLoading,
          setSearchPerformed,
          setDisplayResults,
          setSearchPagination,
          () => generation === searchGenerationRef.current,
        );
      }
    } else {
      discovery.refresh();
    }
  };

  const clearSearch = () => {
    // Bump the generation so any in-flight text search is superseded and can't
    // re-populate the list after the user has cleared it.
    searchGenerationRef.current += 1;
    setSearchQuery('');
    setSearchPerformed(false);
    setSearchData({ items: [], pagination: EMPTY_PAGINATION });
    // Clear the loading flag too — a search cleared mid-flight would otherwise
    // leave the empty state stuck on the "searching…" spinner.
    setSearchLoading(false);
  };

  // ── Empty state ──
  const emptyStateConfig: {
    icon: IconName;
    title: string;
    description: string;
    action?: { label: string; onPress: () => void };
  } = searchLoading
    ? {
        icon: 'search',
        title: t('recipes.searchingTitle'),
        description: t('recipes.searchingDescription'),
      }
    : searchPerformed && activeFilterCount > 0 && searchQuery.trim() !== ''
    ? {
        // Zero TEXT-search results with dietary filters narrowing the search —
        // tell the user why and offer a one-tap recovery instead of a dead
        // end. Ingredient search never applies filters (searchQuery stays
        // empty), so it falls through to the plain empty state.
        icon: 'search-outline',
        title: t('recipes.noRecipesFoundTitle'),
        description: t('recipes.noResultsFiltered', {
          count: activeFilterCount,
        }),
        action: {
          label: t('recipes.clearFiltersAction'),
          onPress: clearFiltersAndSearchAgain,
        },
      }
    : searchPerformed
    ? {
        icon: 'search-outline',
        title: t('recipes.noRecipesFoundTitle'),
        description: t('recipes.noRecipesFoundDescription'),
      }
    : {
        icon: 'restaurant-outline',
        title: t('recipes.discoverTitle'),
        description: t('recipes.discoverDescription'),
      };

  return {
    // Data
    userId,
    discovery,
    pantryItems: discovery.pantryItems,
    hasPantryItems: discovery.hasPantryItems,
    pantryHasMore: discovery.pantryHasMore,
    pantryLoadingMore: discovery.pantryLoadingMore,
    loadMorePantryItems: discovery.loadMorePantryItems,
    discoveryHasMore: discovery.discoveryHasMore,
    loadMoreDiscovery: discovery.loadMoreDiscovery,
    items,

    // Search state
    searchQuery,
    searchResults,
    searchPerformed,
    searchLoading,
    searchLoadingMore,
    searchHasMore,
    loadMoreSearch,
    selectedIngredients,
    ingredientSearchQuery,
    setIngredientSearchQuery,
    filteredPantryItems,
    resetIngredientSearch,

    // Display
    showSearchResults,
    showDiscovery,
    emptyStateConfig,

    // Filters
    activeFilters,
    setActiveFilters,
    activeFilterCount,
    clearFilters,
    removeFilter,
    clearFiltersAndSearchAgain,

    // Actions
    handleTextSearch,
    handleIngredientSearch,
    handleRefresh,
    clearSearch,
    toggleIngredient,
    clearSelectedIngredients,
  };
}
