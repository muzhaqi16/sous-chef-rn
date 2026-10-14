import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { useToday } from '#hooks/useToday';
import type { DisplayItem } from '#features/recipes/utils/recipeDisplayTransforms';
import {
  RecipeSuggestionsDocument,
  type RecipeSuggestionsQuery,
} from './useServerRecipeSuggestions.generated';

/** The server ranks one page; there is no later one to ask for. */
const SUGGESTION_COUNT = 20;

type Suggestion = RecipeSuggestionsQuery['recipeSuggestions']['edges'][number];

/** A suggestion as its card: the stock it uses up first, its coverage as the badge. */
function toItem(edge: Suggestion, translate: Translate): DisplayItem {
  const { node, coverage } = edge;
  const expiring = edge.expiringStacks
    .map(stack => stack.itemName)
    .filter(name => name.trim() !== '');
  const subtitleParts: string[] = [];
  if (expiring.length > 0) {
    subtitleParts.push(
      translate('recipes.usesExpiringSoon', {
        names: expiring.join(', '),
        count: expiring.length,
      }),
    );
  }
  subtitleParts.push(
    translate('recipes.servingsCount', { count: node.servings }),
  );
  if (node.totalTimeMinutes) {
    subtitleParts.push(
      translate('labels.min', { count: node.totalTimeMinutes }),
    );
  }

  return {
    // Opens the recipe itself, as the local rows of a search do.
    id: `local-${node.id}`,
    title: node.name,
    subtitle: subtitleParts.join(' • '),
    badge: {
      text: translate('recipes.pantryCoverage', { percent: coverage }),
      lines: [
        {
          icon: 'checkmark-circle',
          text: translate('recipes.coveragePercent', { percent: coverage }),
          variant: 'success',
        },
      ],
    },
    imageUrl: node.imageUrl ?? undefined,
  };
}

/**
 * The server's suggestions from what the household holds, screened by its
 * dietary profile, in its order. Not `enabled`, it asks for nothing.
 */
export function useServerRecipeSuggestions(enabled: boolean) {
  const { t } = useTranslation();
  const today = useToday();
  const { data, loading, error, refetch } = useQuery(
    RecipeSuggestionsDocument,
    enabled ? { variables: { first: SUGGESTION_COUNT, today } } : skipToken,
  );
  const edges = data?.recipeSuggestions.edges;

  return {
    items: (edges ?? []).map(edge => toItem(edge, t)),
    loading: enabled && loading && !data,
    /** It answered with nothing, or could not answer: someone else may fill in. */
    unanswered: enabled && (edges?.length === 0 || (!!error && !data)),
    refresh: async () => {
      if (!enabled) return;
      await refetch();
    },
  };
}
