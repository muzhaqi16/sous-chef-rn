import type { DocumentNode } from 'graphql';
import { ServerError } from '@apollo/client/errors';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { errorService, isTransportFailure } from '#/services/errorService';
import { isTranslationKey, t } from '#/i18n';
import {
  alertVersionConflict,
  reportMutationFailure,
} from '#/utils/errorHandlers';
import {
  extractMutationPayload,
  isErrorTypename,
} from '#/utils/errors/mutationPayload';
import {
  getVersionConflictMessage,
  VERSION_CONFLICT_CODES,
} from '#/utils/errors/versionConflict';
import { getNotFoundMessage } from '#/utils/errors/notFoundMessage';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';
import { Telemetry } from '#/services/telemetry';
import { operationNameOf } from './documentOperation';

/**
 * Settling a write: the one place a mutation's outcome is read and a failure
 * reported, whichever form the failure arrives in — thrown, resolved as
 * `error`, or returned as a refusal member under `errorPolicy: 'all'`.
 */

export type SettleStatus = 'applied' | 'queued' | 'failed';

/** A failure as the user is told about it. Never the server's `message`. */
export interface SettledFailure {
  code: string | null;
  field: string | null;
  title: string;
  body: string;
}

export interface Settled<TData> {
  status: SettleStatus;
  data: TData | null | undefined;
  failure?: SettledFailure;
}

type Code = `${ErrorCode}` | `${TopLevelErrorCode}`;

export interface SettleOptions {
  /** The document the write sends; its operation name labels the report. */
  document: DocumentNode;
  /** The caller's copy for a failure nothing more specific describes. */
  fallback: string;
  /** The heading for that failure; `labels.error` when absent. */
  title?: string;
  /** Copy replacing the default for a refusal with this code. */
  copy?: { readonly [C in Code]?: { title: string; body: string } };
  /** Undoes the local change. Runs once, on any failure. */
  onFailed?: () => void;
  /** Handling a refusal with this code needs besides its message. */
  on?: { readonly [C in Code]?: () => void };
  /** Offered as the conflict alert's Refresh action. */
  onConflictRefresh?: () => void;
  /** A removal: "not found" means the row is already gone, so it applied. */
  removal?: boolean;
  /** `'none'` leaves presenting the failure to the caller, via `failure`. */
  present?: 'alert' | 'none';
}

interface Failure {
  code: string | null;
  field: string | null;
  resource: string | null;
}

type MutationResult<TData> = { data?: TData | null; error?: unknown };

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

function failureFromError(error: unknown): Failure {
  // A failure the server gave no verdict on carries no code worth naming.
  const code = isTransportFailure(error)
    ? null
    : errorService.parseApolloError(error, { logError: false }).error?.code;
  return { code: code ?? null, field: null, resource: null };
}

function failureFromPayload(payload: object): Failure {
  const code = 'code' in payload ? payload.code : undefined;
  const field = 'field' in payload ? payload.field : undefined;
  const resource = 'resource' in payload ? payload.resource : undefined;
  return {
    code: stringOrNull(code),
    field: stringOrNull(field)?.split('.').pop() ?? null,
    resource: stringOrNull(resource),
  };
}

type Classified =
  | { status: 'applied' | 'queued' }
  | { status: 'failed'; failure: Failure; error?: unknown };

// Widened to `string`, like the codes in errorLink: a `Failure.code` is read
// off an untyped channel, so comparing it to the enum member directly is an
// unsafe-enum comparison.
const VALIDATION_UMBRELLA: string = ErrorCode.ValidationFailed;

const isGoneCode = (code: string | null): boolean =>
  code === ErrorCode.NotFound || code === TopLevelErrorCode.ResourceNotFound;

function classify(
  result: MutationResult<unknown> | undefined,
  thrown: unknown,
  removal: boolean,
): Classified {
  if (!result || result.error) {
    // Apollo resolves `{ data, error }` together when a mutation commits and a
    // field in its selection errors; the payload is the server's verdict.
    const committed = result ? extractMutationPayload(result.data) : null;
    if (committed?.__typename && !isErrorTypename(committed.__typename)) {
      return { status: 'applied' };
    }

    const error = result ? result.error : thrown;
    const failure = failureFromError(error);
    // A gone-code the service never issued — a bare HTTP 404 from a proxy —
    // says nothing about the row. Not queued: a write the queue takes resolves
    // with a null payload instead.
    if (removal && isGoneCode(failure.code) && !ServerError.is(error)) {
      return { status: 'applied' };
    }
    return { status: 'failed', failure, error };
  }
  // The offline queue resolves a queued write with its payload field null.
  const payload = extractMutationPayload(result.data);
  if (!payload) return { status: 'queued' };
  if (!payload.__typename || !isErrorTypename(payload.__typename)) {
    return { status: 'applied' };
  }
  const failure = failureFromPayload(payload);
  if (
    failure.code === ErrorCode.IdempotentReplay ||
    (removal && isGoneCode(failure.code))
  ) {
    return { status: 'applied' };
  }
  return { status: 'failed', failure };
}

/** The outcome alone, with nothing reported — for a caller that only reconciles. */
export function settledStatus(
  result: MutationResult<unknown> | undefined,
  { removal = false }: { removal?: boolean } = {},
): SettleStatus {
  return classify(result, undefined, removal).status;
}

function describe(
  { code, field, resource }: Failure,
  error: unknown,
  options: SettleOptions,
): SettledFailure {
  const title = options.title ?? t('labels.error');
  const copy: Partial<Record<string, { title: string; body: string }>> =
    options.copy ?? {};
  const override = code ? copy[code] : undefined;
  if (override) return { code, field, ...override };

  if (error !== undefined && isRateLimitError(error)) {
    return { code, field, title, body: getRateLimitMessage(error) };
  }
  // Only the version codes mean the row changed since it was read; `CONFLICT`
  // is a state refusal and takes its code's own copy below.
  if (code && VERSION_CONFLICT_CODES.includes(code)) {
    return {
      code,
      field,
      title: t('errors.entityUpdatedTitle', { entity: t('labels.item') }),
      body: getVersionConflictMessage(),
    };
  }
  if (code === TopLevelErrorCode.UnitInvalid) {
    return {
      code,
      field,
      title: t('errors.invalidUnitTitle'),
      body: t('errors.codes.unitInvalid'),
    };
  }
  if (
    code === ErrorCode.NotFound ||
    code === TopLevelErrorCode.ResourceNotFound
  ) {
    return {
      code,
      field,
      title: t('errors.notFoundTitle'),
      body: getNotFoundMessage(resource),
    };
  }
  // Before the field branch: a mapped code names what the server refused, while
  // the field only names where the refusal landed. Over-consuming reports both,
  // and `errors.field.quantity` would call a perfectly valid number invalid
  // when the pantry simply holds less than it asked for. VALIDATION_FAILED is
  // the exception, being the umbrella the field exists to refine.
  if (
    code &&
    code !== VALIDATION_UMBRELLA &&
    errorService.hasUserFriendlyMessage(code)
  ) {
    return {
      code,
      field,
      title,
      body: errorService.getUserFriendlyMessage(code),
    };
  }
  if (field) {
    // The server names the field, so only the loaded copy can say it has one.
    const fieldKey = `errors.field.${field}`;
    return {
      code,
      field,
      title,
      body: isTranslationKey(fieldKey) ? t(fieldKey) : options.fallback,
    };
  }
  return {
    code,
    field,
    title,
    body: code
      ? errorService.getUserFriendlyMessage(code, options.fallback)
      : options.fallback,
  };
}

function fail(
  failure: Failure,
  error: unknown,
  options: SettleOptions,
): SettledFailure {
  options.onFailed?.();
  const handlers: Partial<Record<string, () => void>> = options.on ?? {};
  if (failure.code) handlers[failure.code]?.();

  const described = describe(failure, error, options);
  if (options.present === 'none') return described;

  const isConflict =
    !!failure.code && VERSION_CONFLICT_CODES.includes(failure.code);
  if (isConflict && options.onConflictRefresh) {
    alertVersionConflict({
      onRefresh: options.onConflictRefresh,
      customMessage: described.body,
    });
  } else {
    alertService.alert(described.title, described.body);
  }
  return described;
}

export async function settleMutation<TData>(
  run: () => Promise<MutationResult<TData>>,
  options: SettleOptions,
): Promise<Settled<TData>> {
  let result: MutationResult<TData> | undefined;
  let thrown: unknown;
  try {
    result = await run();
  } catch (error) {
    thrown = error;
  }

  const classified = classify(result, thrown, options.removal ?? false);
  if (classified.status !== 'failed') {
    return { status: classified.status, data: result?.data };
  }

  const failure = fail(classified.failure, classified.error, options);
  const operation = operationNameOf(options.document);
  if ('error' in classified) {
    reportMutationFailure(classified.error, operation);
  } else {
    // A refusal the server returned is a business outcome, not an app error.
    Telemetry.increment('mutation_refused_total', 1, {
      operation,
      code: classified.failure.code ?? 'none',
    });
  }
  return { status: 'failed', data: result?.data, failure };
}
