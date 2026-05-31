/**
 * Invalid Unit Error Details
 */
export interface InvalidUnitDetails {
  rejectedUnit: string;
  validUnits: string[];
}

/**
 * Shape of a single GraphQL error carrying a UNIT_INVALID extension.
 */
interface GraphQLErrorLike {
  message?: string;
  extensions?: {
    code?: string;
    validUnits?: unknown;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getGraphQLErrors(error: unknown): GraphQLErrorLike[] | undefined {
  if (isObject(error) && Array.isArray(error.graphQLErrors)) {
    return error.graphQLErrors as GraphQLErrorLike[];
  }
  return undefined;
}

function getSingleError(error: unknown): GraphQLErrorLike | undefined {
  if (isObject(error) && isObject(error.extensions)) {
    return error as GraphQLErrorLike;
  }
  return undefined;
}

/**
 * Check if an error is a UNIT_INVALID error from the API (Apollo error level)
 *
 * @param error - Error object that may contain GraphQL errors
 * @returns True if the error is an invalid unit error
 */
export function isInvalidUnitError(error: unknown): boolean {
  const graphQLErrors = getGraphQLErrors(error);
  if (graphQLErrors) {
    return graphQLErrors.some(err => err.extensions?.code === 'UNIT_INVALID');
  }

  const single = getSingleError(error);
  if (single) {
    return single.extensions?.code === 'UNIT_INVALID';
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
export function getValidUnits(error: unknown): string[] | null {
  let unitError: GraphQLErrorLike | undefined;

  const graphQLErrors = getGraphQLErrors(error);
  if (graphQLErrors) {
    unitError = graphQLErrors.find(
      err => err.extensions?.code === 'UNIT_INVALID',
    );
  } else {
    unitError = getSingleError(error);
  }

  const validUnits = unitError?.extensions?.validUnits;
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
export function getInvalidUnitMessage(error: unknown): string {
  let unitError: GraphQLErrorLike | undefined;

  const graphQLErrors = getGraphQLErrors(error);
  if (graphQLErrors) {
    unitError = graphQLErrors.find(
      err => err.extensions?.code === 'UNIT_INVALID',
    );
  } else {
    unitError = getSingleError(error);
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
export function handleInvalidUnit(error: unknown): boolean {
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
