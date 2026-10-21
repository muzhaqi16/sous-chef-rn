import { useRef, useState } from 'react';
import type { ApolloClient } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { errorService } from '#/services/errorService';
import { isDeadCursorError } from '#/utils/errors/graphqlErrors';
import { isRateLimitError } from '#/utils/errors/rateLimit';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import type { RecipeFilters as RecipeFiltersInput } from '#/graphql/generated/schemaTypes';
import { catalogIngredientNames } from '#domain/catalogRecipes';
import type { RecipeFilters } from '#features/recipes/utils/recipeFilterOptions';
import {
  foundRow,
  rowKey,
  type FoundRow,
  type RecipeRow,
} from '#features/recipes/utils/recipeRows';
import { SearchRecipesDocument } from './useRecipeSearch.generated';
import { CatalogRecipesByIngredientsDocument } from './useCatalogDiscovery.generated';

const SEARCH_PAGE_SIZE = 25;

/** Why a search showed nothing; the caller says it in its own words. */
export type SearchFailure = 'offline' | 'rateLimited' | 'failed';

export type SearchOutcome =
  /** `partial`: the catalog could not be searched, so only held recipes show. */
  | { status: 'shown'; partial: boolean }
  /** Nothing to say: a newer search or a clear replaced it, or no page came. */
  | { status: 'superseded' }
  | { status: 'failed'; failure: SearchFailure };

const SUPERSEDED: SearchOutcome = { status: 'superseded' };

/** What a search asked for, so a pull can ask it again. */
type LastSearch =
  | { kind: 'text'; query: string }
  | { kind: 'ingredients'; names: string[] };

/** Where a text search's next page starts; null when it has none. */
interface NextPage {
  query: string;
  filters: RecipeFilters;
  after: string;
}

interface SearchPage<TRow extends RecipeRow = RecipeRow> {
  rows: TRow[];
  next: NextPage | null;
  /** Where a page the catalog could not finish goes on once it can. */
  resume: NextPage | null;
  partial: boolean;
}

/** The rows shown and where they go on: ONE atom, so a page commits whole. */
interface Results {
  rows: RecipeRow[];
  next: NextPage | null;
  resume: NextPage | null;
}

const NO_RESULTS: Results = { rows: [], next: null, resume: null };

/**
 * A later page added to what is shown. The API caches the catalog's results a
 * block at a time, so blocks fetched at different times can repeat a hit an
 * earlier page listed.
 */
function withPage(shown: Results, page: SearchPage): Results {
  const listed = new Set(shown.rows.map(rowKey));
  const added = page.rows.filter(row => !listed.has(rowKey(row)));
  return {
    rows: [...shown.rows, ...added],
    next: page.next,
    resume: page.resume,
  };
}

type Fetched<TRow extends RecipeRow = RecipeRow> =
  | { page: SearchPage<TRow> }
  | { error: unknown };

function failedSearch(error: unknown): SearchOutcome {
  errorService.reportError(error, { operation: 'searchRecipes' });
  // Offline is a state, not a failure: the search surface shows its own
  // offline state rather than "search failed", which the reader cannot act on.
  if (isApiUnavailable(useStore.getState())) {
    return { status: 'failed', failure: 'offline' };
  }
  if (isRateLimitError(error)) {
    return { status: 'failed', failure: 'rateLimited' };
  }
  return { status: 'failed', failure: 'failed' };
}

const filtersInput = (filters: RecipeFilters): RecipeFiltersInput => ({
  ...(filters.diet.length > 0 && { diets: filters.diet }),
  ...(filters.intolerances.length > 0 && {
    intolerances: filters.intolerances,
  }),
  ...(filters.mealType && { category: filters.mealType }),
  ...(filters.maxReadyTime && { maxReadyTime: filters.maxReadyTime }),
});

/** One page of a text search; the error, not a throw, when it fails. */
export async function fetchTextPage(
  client: ApolloClient,
  query: string,
  filters: RecipeFilters,
  after: string | null,
): Promise<Fetched<FoundRow>> {
  try {
    const result = await client.query({
      query: SearchRecipesDocument,
      variables: {
        query,
        filters: filtersInput(filters),
        first: SEARCH_PAGE_SIZE,
        after,
      },
      // Nothing reads a search back from the cache, so it is never written.
      fetchPolicy: 'no-cache',
    });
    const found = result.data?.findRecipes;
    if (!found) return { error: result.error };
    const { hasNextPage, endCursor } = found.pageInfo;
    const from = endCursor ? { query, filters, after: endCursor } : null;
    return {
      page: {
        rows: found.edges.map(edge => foundRow(edge.node)),
        next: hasNextPage ? from : null,
        // `hasNextPage` is false while the catalog is out; its cursor resumes it.
        resume: found.catalogAvailable ? null : from,
        partial: !found.catalogAvailable,
      },
    };
  } catch (error) {
    return { error };
  }
}

const sameFilters = (a: RecipeFilters, b: RecipeFilters): boolean =>
  JSON.stringify(filtersInput(a)) === JSON.stringify(filtersInput(b));

async function fetchIngredientPage(
  client: ApolloClient,
  ingredients: string[],
): Promise<Fetched> {
  try {
    const result = await client.query({
      query: CatalogRecipesByIngredientsDocument,
      variables: { ingredients, first: SEARCH_PAGE_SIZE },
      fetchPolicy: 'no-cache',
    });
    const found = result.data?.catalogRecipesByIngredients;
    if (!found) return { error: result.error };
    return {
      page: {
        rows: found.edges.map(
          (edge): RecipeRow => ({ source: 'pantry', edge }),
        ),
        next: null,
        resume: null,
        partial: !found.catalogAvailable,
      },
    };
  } catch (error) {
    return { error };
  }
}

/** The next page of a text search; null after a failure it has reported. */
async function fetchNextPage(
  client: ApolloClient,
  next: NextPage,
): Promise<SearchPage | null> {
  const fetched = await fetchTextPage(
    client,
    next.query,
    next.filters,
    next.after,
  );
  if ('page' in fetched) return fetched.page;
  // Shown results stay on screen; the list just stops growing.
  errorService.reportError(fetched.error, {
    operation: 'searchRecipesLoadMore',
  });
  return null;
}

/**
 * Recipe search through the API: the recipes it holds, best match first, then
 * the catalog's, one cursor for both. The caller presents each search's
 * outcome itself.
 */
export function useRecipeSearch() {
  const client = useApolloClient();
  // Each search captures it and commits only while it is still current, so a
  // newer search or a clear supersedes one in flight.
  const generationRef = useRef(0);
  const [last, setLast] = useState<LastSearch | null>(null);
  const [loading, setLoading] = useState(false);
  // Drops re-entrant load-mores: onEndReached fires again before a page lands.
  const [loadingMore, setLoadingMore] = useState(false);
  // A changed `next` or `resume` identity tells a page in flight that a new
  // search replaced the state.
  const [results, setResults] = useState<Results>(NO_RESULTS);

  const supersede = () => {
    generationRef.current += 1;
    const generation = generationRef.current;
    return () => generation === generationRef.current;
  };

  const run = async (
    searched: LastSearch,
    fetchPage: () => Promise<Fetched>,
  ): Promise<SearchOutcome> => {
    const isCurrent = supersede();
    setLoading(true);
    setLast(searched);
    const fetched = await fetchPage();
    // A newer search fired mid-flight: discard this response whole, so it
    // cannot clobber the newer results or the loading flag it now owns.
    if (!isCurrent()) return SUPERSEDED;
    setLoading(false);
    if ('error' in fetched) {
      setResults(NO_RESULTS);
      return failedSearch(fetched.error);
    }
    const { rows, next, resume } = fetched.page;
    setResults({ rows, next, resume });
    return { status: 'shown', partial: fetched.page.partial };
  };

  const search = (text: string, filters: RecipeFilters) =>
    run({ kind: 'text', query: text }, () =>
      fetchTextPage(client, text, filters, null),
    );

  // One page, with no filters: the API ranks by the ingredients alone.
  const searchByIngredients = (ingredients: readonly string[]) => {
    const names = catalogIngredientNames(ingredients);
    return run({ kind: 'ingredients', names }, () =>
      fetchIngredientPage(client, names),
    );
  };

  // The last search again; filters apply to a text search only.
  const rerun = (filters: RecipeFilters): Promise<SearchOutcome> => {
    if (last === null) return Promise.resolve(SUPERSEDED);
    return last.kind === 'text'
      ? search(last.query, filters)
      : searchByIngredients(last.names);
  };

  const { next } = results;

  const loadMore = async (): Promise<SearchOutcome> => {
    if (!next || loadingMore) return SUPERSEDED;
    const generation = generationRef.current;
    let outcome: SearchOutcome = SUPERSEDED;
    await executeWithLoadingState(async () => {
      const page = await fetchNextPage(client, next);
      // A new search or clear mid-flight replaced `next`; this page belongs to
      // the old query.
      if (!page || generation !== generationRef.current) return;
      outcome = { status: 'shown', partial: page.partial };
      setResults(prev => (prev.next === next ? withPage(prev, page) : prev));
    }, setLoadingMore);
    return outcome;
  };

  /**
   * A pull. A text search the catalog could not finish goes on from where it
   * stopped, keeping its rows; any other search, or one whose cursor the API
   * refuses, runs again from its first page.
   */
  const retry = async (filters: RecipeFilters): Promise<SearchOutcome> => {
    const { resume } = results;
    if (!resume || loadingMore || !sameFilters(resume.filters, filters)) {
      return rerun(filters);
    }
    const generation = generationRef.current;
    setLoadingMore(true);
    // Never throws: a failure comes back as `{ error }`.
    const fetched = await fetchTextPage(
      client,
      resume.query,
      resume.filters,
      resume.after,
    );
    setLoadingMore(false);
    if (generation !== generationRef.current) return SUPERSEDED;
    if ('error' in fetched) {
      // Shown results stay on screen; the pull says why it found no more.
      return isDeadCursorError(fetched.error, resume.after)
        ? rerun(filters)
        : failedSearch(fetched.error);
    }
    const { page } = fetched;
    setResults(prev => (prev.resume === resume ? withPage(prev, page) : prev));
    return { status: 'shown', partial: page.partial };
  };

  const clear = () => {
    supersede();
    setLast(null);
    setResults(NO_RESULTS);
    // A search cleared mid-flight would otherwise leave loading stuck on.
    setLoading(false);
  };

  return {
    query: last?.kind === 'text' ? last.query : '',
    rows: results.rows,
    performed: last !== null,
    loading,
    loadingMore,
    hasMore: next !== null,
    search,
    searchByIngredients,
    retry,
    loadMore,
    clear,
  };
}
