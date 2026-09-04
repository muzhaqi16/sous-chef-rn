import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

/**
 * Shape of a single GraphQL error carrying a UNIT_INVALID extension.
 */
interface GraphQLErrorLike {
  message?: string;
  extensions?: {
    code?: string;
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
 * Whether an Apollo-level error is the API's UNIT_INVALID refusal. Nothing is
 * extractable from it: no machine-readable list of units that WOULD work, and
 * an unlocalizable English `message`. Callers report `errors.codes.unitInvalid`
 * and re-query the ranked-unit list, as `schema.graphql` directs.
 */
export function isInvalidUnitError(error: unknown): boolean {
  const graphQLErrors = getGraphQLErrors(error);
  if (graphQLErrors) {
    return graphQLErrors.some(
      err => err.extensions?.code === TopLevelErrorCode.UnitInvalid,
    );
  }

  const single = getSingleError(error);
  if (single) {
    return single.extensions?.code === TopLevelErrorCode.UnitInvalid;
  }

  return false;
}

/**
 * Whether an errors-as-data member's `code` marks a UNIT_INVALID refusal — pass
 * the member's code directly (there is no `success` field on current payloads).
 */
export function isInvalidUnitPayload(code: string): boolean {
  return code === TopLevelErrorCode.UnitInvalid;
}
