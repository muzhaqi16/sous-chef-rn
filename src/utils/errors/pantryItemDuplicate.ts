export interface PantryItemDuplicateInfo {
  existingPantryItemId: string;
  existingPantryItemIds: string[];
}

const ERROR_CODE = 'PANTRY_ITEM_ALREADY_EXISTS';

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
