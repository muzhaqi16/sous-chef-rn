import { useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { errorCopy } from '#/services/errorService';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useAutocompleteSearch } from '#features/catalog/hooks/useAutocompleteSearch';
import {
  CommonlyAvoidedFoodsDocument,
  SearchAvoidableFoodsDocument,
  type SearchAvoidableFoodsQuery,
} from './useAvoidFoodSearch.generated';

/** `searchItems` refuses a query shorter than this, after trimming. */
const MIN_QUERY_LENGTH = 3;
const PAGE_SIZE = 10;
/** The API caps the admins' list at 50; a sheet shows the first few. */
const SUGGESTION_COUNT = 12;

/** A food as the sheet holds it: its row reads its own fragment off this ref. */
export type AvoidableFood =
  SearchAvoidableFoodsQuery['searchItems']['edges'][number]['node'];

/**
 * The catalog foods (never products) the avoid sheet offers: for a typed term,
 * or with nothing typed, the foods people commonly avoid that are not `avoided`.
 */
export function useAvoidFoodSearch({
  active,
  avoided,
}: {
  /** The sheet is open: only then are the suggestions asked for. */
  active: boolean;
  /** Item ids already avoided, left out of the suggestions. */
  avoided: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const offline = useIsApiUnavailable();
  // The term last searched; only `useAutocompleteSearch` sets it, at 3+ characters.
  const [term, setTerm] = useState('');

  const { data, loading, error, variables } = useQuery(
    SearchAvoidableFoodsDocument,
    term !== '' && !offline
      ? { variables: { query: term, first: PAGE_SIZE }, refetchOn: false }
      : skipToken,
  );
  useApolloErrorLogger(SearchAvoidableFoodsDocument, error);

  // `skipToken` keeps the last run's answer: it stands only for the term it was asked with.
  const answersTerm = !offline && term !== '' && variables.query === term;
  const results = answersTerm
    ? (data?.searchItems.edges ?? []).map(edge => edge.node)
    : [];

  const autocomplete = useAutocompleteSearch<AvoidableFood>({
    search: setTerm,
    getResults: () => results,
    loading,
    keyExtractor: food => food.id,
    minChars: MIN_QUERY_LENGTH,
    // The field debounces; the term it reports is searched at once.
    debounceMs: 0,
    maxResults: PAGE_SIZE,
  });

  const { searchTerm } = autocomplete;

  // Asked while the sheet is open, not only while the field is empty, so
  // clearing it shows them again at once.
  const suggested = useQuery(
    CommonlyAvoidedFoodsDocument,
    active && !offline
      ? { variables: { first: SUGGESTION_COUNT }, refetchOn: false }
      : skipToken,
  );
  useApolloErrorLogger(CommonlyAvoidedFoodsDocument, suggested.error);
  const suggestions =
    active && !offline && searchTerm === ''
      ? (suggested.data?.items.edges ?? []).flatMap(({ node }) =>
          avoided.has(node.id) ? [] : [node],
        )
      : [];

  const answered =
    answersTerm && searchTerm === term && !autocomplete.searchPending;

  return {
    foods: autocomplete.displayItems,
    suggestions,
    searchTerm,
    searching: loading,
    offline,
    noMatches: answered && !error && results.length === 0,
    failure:
      answered && error
        ? errorCopy(error, t, t('errors.codes.genericRetry'))
        : null,
    onSearchTermChange: (text: string) => {
      autocomplete.handleSearchTermChange(text.trim());
    },
    reset: () => {
      autocomplete.reset();
      setTerm('');
    },
  };
}
