/**
 * Version Conflict Error Details
 */
export interface VersionConflictDetails {
  resourceType: string;
  currentVersion: number;
  expectedVersion: number;
}

/**
 * Check if an error is a CONFLICT error from the API (Apollo error level)
 *
 * @param error - Error object that may contain GraphQL errors
 * @returns True if the error is a version conflict
 */
export function isVersionConflictError(error: any): boolean {
  if ('graphQLErrors' in error && error.graphQLErrors) {
    return error.graphQLErrors.some(
      (err: any) => err.extensions?.code === 'CONFLICT',
    );
  }

  if ('extensions' in error && error.extensions) {
    return error.extensions.code === 'CONFLICT';
  }

  return false;
}

/**
 * Check if a mutation payload indicates a CONFLICT error.
 * Use this to detect version conflicts returned as payload fields (success: false, code: 'CONFLICT')
 * rather than thrown GraphQL errors.
 */
export function isVersionConflictPayload(payload: {
  success: boolean;
  code: string;
}): boolean {
  return !payload.success && payload.code === 'CONFLICT';
}

/**
 * Extract version conflict details from an error
 *
 * @param error - Error containing CONFLICT
 * @returns Version conflict details or null if not a version conflict
 */
export function getVersionConflictDetails(
  error: any,
): VersionConflictDetails | null {
  let versionError: any | undefined;

  if ('graphQLErrors' in error && error.graphQLErrors) {
    versionError = error.graphQLErrors.find(
      (err: any) => err.extensions?.code === 'CONFLICT',
    );
  } else if ('extensions' in error && error.extensions) {
    versionError = error;
  }

  if (!versionError || !versionError.extensions) {
    return null;
  }

  const { resourceType, currentVersion, expectedVersion } =
    versionError.extensions;

  if (
    typeof resourceType === 'string' &&
    typeof currentVersion === 'number' &&
    typeof expectedVersion === 'number'
  ) {
    return {
      resourceType,
      currentVersion,
      expectedVersion,
    };
  }

  return null;
}

/**
 * Get a user-friendly message for a version conflict error
 *
 * @param error - Error containing CONFLICT
 * @returns User-friendly error message
 */
export function getVersionConflictMessage(error: any): string {
  const details = getVersionConflictDetails(error);

  if (!details) {
    return 'This item was updated by another user. Please refresh and try again.';
  }

  return `This ${details.resourceType.toLowerCase()} was updated by another user. Please refresh and try again.`;
}

/**
 * Handle version conflict errors with user-friendly alerts
 *
 * @param error - Apollo error to check
 * @param onRefresh - Optional callback to refresh data
 * @returns True if error was a version conflict and was handled
 *
 * @example
 * ```typescript
 * try {
 *   await updateQuantity({ id, quantity, version });
 * } catch (error) {
 *   if (handleVersionConflict(error, () => refetch())) {
 *     return; // Error was handled
 *   }
 *   // Handle other errors
 * }
 * ```
 */
export function handleVersionConflict(error: any): boolean {
  if (!isVersionConflictError(error)) {
    return false;
  }

  const message = getVersionConflictMessage(error);
  const details = getVersionConflictDetails(error);

  console.warn('⚠️ Version conflict detected:', {
    message,
    details,
    error,
  });

  // Return true to indicate the error was a version conflict
  // The caller should show an appropriate UI alert
  return true;
}
