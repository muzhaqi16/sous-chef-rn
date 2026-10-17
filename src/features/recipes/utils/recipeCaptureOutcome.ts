import {
  MeasurementRegionBasis,
  RecipeCaptureFailure,
  RecipeCaptureStatus,
  RecipeCaptureWarningCode,
} from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';
import {
  dailyAllowanceWait,
  isFeatureDisabled,
  isPremiumRequired,
  isUpgradeRequired,
  isVerdict,
} from '#domain/serverJobRefusals';
import type { RecipeCaptureReadersFragment } from '#/graphql/readers/recipeCaptureReaders.generated';

type Capture = Pick<
  RecipeCaptureReadersFragment,
  'status' | 'alreadySaved' | 'failure' | 'recipe'
>;

/** What the user is told about a capture that read no recipe. */
type FailureCopy =
  | 'unreachable'
  | 'unsupportedPage'
  | 'noRecipe'
  | 'unreadable'
  | 'photoRefused'
  | 'photoStorage'
  | 'unavailable';

// Exhaustive, so a code the schema adds fails to compile until it is placed.
const FAILURE_COPY: Record<RecipeCaptureFailure, FailureCopy> = {
  [RecipeCaptureFailure.UnreachableUrl]: 'unreachable',
  [RecipeCaptureFailure.UnsupportedPage]: 'unsupportedPage',
  [RecipeCaptureFailure.NoRecipe]: 'noRecipe',
  [RecipeCaptureFailure.Truncated]: 'unreadable',
  [RecipeCaptureFailure.InvalidAnswer]: 'unreadable',
  [RecipeCaptureFailure.ReadFailed]: 'unreadable',
  [RecipeCaptureFailure.PhotoRefused]: 'photoRefused',
  [RecipeCaptureFailure.PhotoStorage]: 'photoStorage',
  [RecipeCaptureFailure.CallerGone]: 'unavailable',
  [RecipeCaptureFailure.DeadlinePassed]: 'unavailable',
  [RecipeCaptureFailure.ModelDown]: 'unavailable',
  [RecipeCaptureFailure.NoModel]: 'unavailable',
  [RecipeCaptureFailure.NoService]: 'unavailable',
  [RecipeCaptureFailure.NoWorker]: 'unavailable',
  [RecipeCaptureFailure.QueueUnavailable]: 'unavailable',
  [RecipeCaptureFailure.RequestRefused]: 'unavailable',
  [RecipeCaptureFailure.ServiceError]: 'unavailable',
  [RecipeCaptureFailure.ServiceLacksRecipes]: 'unavailable',
  [RecipeCaptureFailure.ServiceRefusedToken]: 'unavailable',
  [RecipeCaptureFailure.ServiceTimeout]: 'unavailable',
  [RecipeCaptureFailure.ServiceUnreachable]: 'unavailable',
  [RecipeCaptureFailure.Unknown]: 'unavailable',
};

export const CAPTURE_FAILURE_KEY: Record<FailureCopy, TranslationKey> = {
  unreachable: 'recipes.captureFailedUnreachable',
  unsupportedPage: 'recipes.captureFailedUnsupportedPage',
  noRecipe: 'recipes.captureFailedNoRecipe',
  unreadable: 'recipes.captureFailedUnreadable',
  photoRefused: 'recipes.captureFailedPhotoRefused',
  photoStorage: 'recipes.captureFailedPhotoStorage',
  unavailable: 'recipes.captureFailedUnavailable',
};

export const CAPTURE_WARNING_KEY: Record<
  RecipeCaptureWarningCode,
  TranslationKey
> = {
  [RecipeCaptureWarningCode.UngroundedLine]: 'recipes.captureWarningUngrounded',
  [RecipeCaptureWarningCode.LowText]: 'recipes.captureWarningLowText',
  [RecipeCaptureWarningCode.ContentClamped]: 'recipes.captureWarningClamped',
};

export const MEASUREMENT_BASIS_KEY: Record<
  MeasurementRegionBasis,
  TranslationKey
> = {
  [MeasurementRegionBasis.PageLanguage]: 'recipes.unitsReadByPageLanguage',
  [MeasurementRegionBasis.SiteDomain]: 'recipes.unitsReadBySiteDomain',
  [MeasurementRegionBasis.CallerLocale]: 'recipes.unitsReadByCallerLocale',
  [MeasurementRegionBasis.UserSetting]: 'recipes.unitsReadByUserSetting',
  [MeasurementRegionBasis.Default]: 'recipes.unitsReadByDefault',
};

// A newer server can send a code this build was compiled without.
const isKnownFailure = (code: string): code is RecipeCaptureFailure =>
  Object.hasOwn(FAILURE_COPY, code);

/** A failure code's copy; one this build does not know reads as unavailable. */
function failureCopyOf(failure: string | null): FailureCopy {
  return failure && isKnownFailure(failure)
    ? FAILURE_COPY[failure]
    : 'unavailable';
}

export type CaptureOutcome =
  | {
      kind: 'saved';
      /** Null once the user deleted it. */
      recipe: { id: string; name: string } | null;
      alreadySaved: boolean;
    }
  | { kind: 'incomplete' }
  | { kind: 'failed'; copy: FailureCopy };

/** A capture the server never answered for, or past its deadline. */
export const UNANSWERED_CAPTURE: CaptureOutcome = {
  kind: 'failed',
  copy: 'unavailable',
};

/** How a capture ended; undefined while it is still reading. */
export function captureOutcomeOf(capture: Capture): CaptureOutcome | undefined {
  switch (capture.status) {
    case RecipeCaptureStatus.Pending:
      return undefined;
    case RecipeCaptureStatus.Saved:
      return {
        kind: 'saved',
        recipe: capture.recipe,
        alreadySaved: capture.alreadySaved,
      };
    case RecipeCaptureStatus.Incomplete:
      return { kind: 'incomplete' };
    case RecipeCaptureStatus.Failed:
    case RecipeCaptureStatus.Unavailable:
      return { kind: 'failed', copy: failureCopyOf(capture.failure) };
  }
}

/** The inputs a refusal can name, as the sheets show them. */
export type CaptureField = 'url' | 'text' | 'photos' | 'sourceUrl';

function captureFieldOf(field: string | null): CaptureField | null {
  if (field === null) return null;
  switch (field) {
    case 'url':
    case 'text':
    case 'photos':
    case 'sourceUrl':
      return field;
    default:
      return null;
  }
}

/**
 * What to do with the answer to a create: poll a capture still reading, settle
 * one a replay or a fast worker already finished, report a refusal on its
 * field, wait out the daily allowance, ask for an update, or send again.
 */
export type CaptureCreateResult =
  | { kind: 'poll' }
  | { kind: 'settle'; outcome: CaptureOutcome }
  | { kind: 'refused'; field: CaptureField | null }
  | { kind: 'limited'; retryAt: string }
  | { kind: 'upgrade' }
  | { kind: 'disabled' }
  | { kind: 'premium' }
  | { kind: 'resend' };

export function classifyCaptureCreate(
  {
    accepted,
    capture,
    refusedField,
    error,
  }: {
    accepted: boolean;
    /** The capture the payload wrote to the cache, if it did. */
    capture: Capture | null;
    refusedField: string | null;
    error: unknown;
  },
  now = Date.now(),
): CaptureCreateResult {
  if (accepted) {
    const outcome = capture ? captureOutcomeOf(capture) : undefined;
    return outcome ? { kind: 'settle', outcome } : { kind: 'poll' };
  }
  const retryAfter = dailyAllowanceWait(error);
  if (retryAfter !== null) {
    return {
      kind: 'limited',
      retryAt: new Date(now + retryAfter * 1000).toISOString(),
    };
  }
  if (isUpgradeRequired(error)) return { kind: 'upgrade' };
  if (isFeatureDisabled(error)) return { kind: 'disabled' };
  if (isPremiumRequired(error)) return { kind: 'premium' };
  // A refusal, in the payload or not, stands; one that never arrived does not.
  if (error === undefined || isVerdict(error)) {
    return { kind: 'refused', field: captureFieldOf(refusedField) };
  }
  return { kind: 'resend' };
}
