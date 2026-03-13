/**
 * Invalid Unit Error Details
 */
export interface InvalidUnitDetails {
  rejectedUnit: string;
  validUnits: string[];
}

/**
 * Check if an error is a UNIT_INVALID error from the API (Apollo error level)
 *
 * @param error - Error object that may contain GraphQL errors
 * @returns True if the error is an invalid unit error
 */
export function isInvalidUnitError(error: any): boolean {
  if ('graphQLErrors' in error && error.graphQLErrors) {
    return error.graphQLErrors.some(
      (err: any) => err.extensions?.code === 'UNIT_INVALID',
    );
  }

  if ('extensions' in error && error.extensions) {
    return error.extensions.code === 'UNIT_INVALID';
  }

  return false;
}

/**
 * Check if a mutation payload indicates a UNIT_INVALID error.
 * Use this to detect unit errors returned as payload fields (success: false, code: 'UNIT_INVALID')
 * rather than thrown GraphQL errors.
 */
export function isInvalidUnitPayload(payload: {
  success: boolean;
  code: string;
}): boolean {
  return !payload.success && payload.code === 'UNIT_INVALID';
}

/**
 * Extract valid units from a UNIT_INVALID error
 *
 * @param error - Error containing UNIT_INVALID
 * @returns Array of valid unit symbols, or null if not a UNIT_INVALID error
 */
export function getValidUnits(error: any): string[] | null {
  let unitError: any | undefined;

  if ('graphQLErrors' in error && error.graphQLErrors) {
    unitError = error.graphQLErrors.find(
      (err: any) => err.extensions?.code === 'UNIT_INVALID',
    );
  } else if ('extensions' in error && error.extensions) {
    unitError = error;
  }

  if (!unitError?.extensions?.validUnits) {
    return null;
  }

  const { validUnits } = unitError.extensions;
  if (Array.isArray(validUnits)) {
    return validUnits;
  }

  return null;
}

/**
 * Get a user-friendly message for a UNIT_INVALID error
 *
 * @param error - Error containing UNIT_INVALID
 * @returns User-friendly error message
 */
export function getInvalidUnitMessage(error: any): string {
  let unitError: any | undefined;

  if ('graphQLErrors' in error && error.graphQLErrors) {
    unitError = error.graphQLErrors.find(
      (err: any) => err.extensions?.code === 'UNIT_INVALID',
    );
  } else if ('extensions' in error && error.extensions) {
    unitError = error;
  }

  if (unitError?.message) {
    return unitError.message;
  }

  return 'This unit is not available for this operation. Please select a different unit.';
}

/**
 * Handle invalid unit errors — check and return whether it was handled
 *
 * @param error - Apollo error to check
 * @returns True if error was an invalid unit error
 */
export function handleInvalidUnit(error: any): boolean {
  if (!isInvalidUnitError(error)) {
    return false;
  }

  const message = getInvalidUnitMessage(error);
  const validUnits = getValidUnits(error);

  console.warn('⚠️ Invalid unit detected:', {
    message,
    validUnits,
    error,
  });

  return true;
}
