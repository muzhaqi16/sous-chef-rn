import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

export interface PantryItemDuplicateInfo {
  existingPantryItemId: string;
  existingPantryItemIds: string[];
}

const ERROR_CODE = TopLevelErrorCode.PantryItemAlreadyExists;

interface GraphQLErrorLike {
  extensions?: {
    code?: string;
    existingPantryItemId?: string;
    existingPantryItemIds?: string[];
  };
  message?: string;
}

function getGraphQLErrors(error: unknown): GraphQLErrorLike[] | null {
  if (error == null || typeof error !== 'object') return null;

  // CombinedGraphQLErrors (Apollo Client 4) — has .errors
  if ('errors' in error) {
    const { errors } = error as { errors: unknown };
    if (Array.isArray(errors)) return errors;
  }

  // Legacy ApolloError — has .graphQLErrors
  if ('graphQLErrors' in error) {
    const { graphQLErrors } = error as { graphQLErrors: unknown };
    if (Array.isArray(graphQLErrors)) return graphQLErrors;
  }

  return null;
}

/**
 * Check if an error is a PANTRY_ITEM_ALREADY_EXISTS error from the API
 *
 * @param error - Error object that may contain GraphQL errors
 * @returns True if the error is a pantry item duplicate
 */
export function isPantryItemDuplicateError(error: unknown): boolean {
  const gqlErrors = getGraphQLErrors(error);
  if (gqlErrors) {
    return gqlErrors.some(err => err.extensions?.code === ERROR_CODE);
  }

  // Single GraphQL error with extensions
  if (error != null && typeof error === 'object' && 'extensions' in error) {
    const { extensions } = error as GraphQLErrorLike;
    return extensions?.code === ERROR_CODE;
  }

  return false;
}

/**
 * Extract duplicate pantry item info from an error
 *
 * @param error - Error containing PANTRY_ITEM_ALREADY_EXISTS
 * @returns Duplicate info with existing item IDs, or null if not a duplicate error
 */
export function getPantryItemDuplicateInfo(
  error: unknown,
): PantryItemDuplicateInfo | null {
  let duplicateError: GraphQLErrorLike | undefined;

  const gqlErrors = getGraphQLErrors(error);
  if (gqlErrors) {
    duplicateError = gqlErrors.find(err => err.extensions?.code === ERROR_CODE);
  } else if (
    error != null &&
    typeof error === 'object' &&
    'extensions' in error
  ) {
    duplicateError = error as GraphQLErrorLike;
  }

  if (!duplicateError?.extensions) {
    return null;
  }

  const { existingPantryItemId, existingPantryItemIds } =
    duplicateError.extensions;

  if (typeof existingPantryItemId === 'string') {
    return {
      existingPantryItemId,
      existingPantryItemIds: Array.isArray(existingPantryItemIds)
        ? existingPantryItemIds
        : [existingPantryItemId],
    };
  }

  return null;
}

/**
 * Reads the union-member form of a duplicate; `getPantryItemDuplicateInfo` above
 * reads the GraphQL-error form. Restock targets one item, so the first id
 * becomes `existingPantryItemId`.
 */
export function getPantryItemDuplicateInfoFromPayload(
  payload:
    | { existingPantryItemIds?: readonly string[] | null }
    | null
    | undefined,
): PantryItemDuplicateInfo | null {
  const ids = payload?.existingPantryItemIds;
  if (ids && ids.length > 0) {
    return { existingPantryItemId: ids[0], existingPantryItemIds: [...ids] };
  }
  return null;
}

/**
 * Checks BOTH shapes a duplicate can arrive in — a `DuplicatePantryItemError`
 * union member, and a GraphQL error carrying `PANTRY_ITEM_ALREADY_EXISTS` — so
 * every add surface routes to the restock prompt either way. `payload` is typed
 * loosely so every operation's generated union is structurally assignable.
 */
export function getPantryItemDuplicateFromResult(
  payload:
    | { __typename?: string; existingPantryItemIds?: readonly string[] | null }
    | null
    | undefined,
  error: unknown,
): PantryItemDuplicateInfo | null {
  if (payload?.__typename === 'DuplicatePantryItemError') {
    const info = getPantryItemDuplicateInfoFromPayload(payload);
    if (info) return info;
  }
  if (error != null && isPantryItemDuplicateError(error)) {
    return getPantryItemDuplicateInfo(error);
  }
  return null;
}

/**
 * The shared "Item Already in Pantry" prompt: copy lives here once so it cannot
 * drift across the add surfaces. Restock and Add Anyway are site-specific
 * (different mutations and success UX), so the caller supplies them.
 */
export function promptPantryDuplicate(opts: {
  onRestock: () => void;
  onAddAnyway: () => void;
  onCancel?: () => void;
}): void {
  alertService.alert(t('duplicateItem.title'), t('duplicateItem.body'), [
    { text: t('labels.cancel'), style: 'cancel', onPress: opts.onCancel },
    { text: t('duplicateItem.restock'), onPress: opts.onRestock },
    { text: t('duplicateItem.addAnyway'), onPress: opts.onAddAnyway },
  ]);
}
