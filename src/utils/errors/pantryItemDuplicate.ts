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
 * Extract duplicate info from a `DuplicatePantryItemError` union payload.
 *
 * The server returns the duplicate two ways: as a GraphQL error carrying the
 * `PANTRY_ITEM_ALREADY_EXISTS` code (handled by `getPantryItemDuplicateInfo`
 * above), or — per the regenerated schema — as a typed member of the
 * `CreatePantryItemResult` union in `data`. This reads the latter. The restock
 * action targets a single item, so the first id is used as `existingPantryItemId`.
 *
 * @param payload - the `createPantryItem` union payload
 * @returns Duplicate info, or null if the payload carries no existing ids
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
 * Resolve duplicate info from a `createPantryItem` mutation result, checking
 * BOTH ways the server can report a duplicate:
 *
 * 1. As a typed `DuplicatePantryItemError` member of the result union (in
 *    `data.createPantryItem`) — the current contract.
 * 2. As a GraphQL error carrying the `PANTRY_ITEM_ALREADY_EXISTS` code (in
 *    `result.error`) — the legacy shape.
 *
 * Every add surface should call this so a duplicate routes to the restock /
 * add-anyway prompt regardless of which shape the server uses. Returns null
 * when the result isn't a duplicate.
 *
 * The `payload` param is typed loosely (`{ __typename?, existingPantryItemIds? }`)
 * so every operation's generated `createPantryItem` union — even ones whose
 * `DuplicatePantryItemError` selection is minimal — is structurally assignable.
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
 * Standard "Item Already in Pantry" recovery prompt shown when a create is
 * refused as a duplicate. The title, message, and Cancel / Restock / Add Anyway
 * buttons are identical across every add surface (create form, multi-page
 * submission, barcode scan), so the copy lives here once and can't drift. The
 * Restock and Add Anyway actions are genuinely site-specific — different
 * mutations, loading state, and success UX — so the caller supplies them.
 * `onCancel` is optional, for sites that resolve a promise when dismissed.
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
