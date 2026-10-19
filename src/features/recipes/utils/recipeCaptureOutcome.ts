import {
  MeasurementRegionBasis,
  RecipeCaptureFailure,
  RecipeCaptureStatus,
  RecipeCaptureWarningCode,
  type CreateRecipeCaptureInput,
} from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';
import { dailyAllowanceWait, isVerdict } from '#domain/serverJobRefusals';
import type { RecipeCaptureReadersFragment } from '#/graphql/readers/recipeCaptureReaders.generated';

type Capture = Pick<
  RecipeCaptureReadersFragment,
  'status' | 'alreadySaved' | 'failure' | 'recipe'
>;

const UNAVAILABLE: TranslationKey = 'recipes.captureFailedUnavailable';

// Exhaustive, so a code the schema adds fails to compile until it is placed.
const FAILURE_KEY: Record<RecipeCaptureFailure, TranslationKey> = {
  [RecipeCaptureFailure.UnreachableUrl]: 'recipes.captureFailedUnreachable',
  [RecipeCaptureFailure.UnsupportedPage]:
    'recipes.captureFailedUnsupportedPage',
  [RecipeCaptureFailure.NoRecipe]: 'recipes.captureFailedNoRecipe',
  [RecipeCaptureFailure.Truncated]: 'recipes.captureFailedUnreadable',
  [RecipeCaptureFailure.InvalidAnswer]: 'recipes.captureFailedUnreadable',
  [RecipeCaptureFailure.ReadFailed]: 'recipes.captureFailedUnreadable',
  [RecipeCaptureFailure.PhotoRefused]: 'recipes.captureFailedPhotoRefused',
  [RecipeCaptureFailure.PhotoStorage]: 'recipes.captureFailedPhotoStorage',
  [RecipeCaptureFailure.CallerGone]: UNAVAILABLE,
  [RecipeCaptureFailure.DeadlinePassed]: UNAVAILABLE,
  [RecipeCaptureFailure.ModelDown]: UNAVAILABLE,
  [RecipeCaptureFailure.NoModel]: UNAVAILABLE,
  [RecipeCaptureFailure.NoService]: UNAVAILABLE,
  [RecipeCaptureFailure.NoWorker]: UNAVAILABLE,
  [RecipeCaptureFailure.QueueUnavailable]: UNAVAILABLE,
  [RecipeCaptureFailure.RequestRefused]: UNAVAILABLE,
  [RecipeCaptureFailure.ServiceError]: UNAVAILABLE,
  [RecipeCaptureFailure.ServiceLacksRecipes]: UNAVAILABLE,
  [RecipeCaptureFailure.ServiceRefusedToken]: UNAVAILABLE,
  [RecipeCaptureFailure.ServiceTimeout]: UNAVAILABLE,
  [RecipeCaptureFailure.ServiceUnreachable]: UNAVAILABLE,
  [RecipeCaptureFailure.Unknown]: UNAVAILABLE,
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
  Object.hasOwn(FAILURE_KEY, code);

export type CaptureOutcome =
  | {
      kind: 'saved';
      /** Null once the user deleted it. */
      recipe: { id: string; name: string } | null;
      alreadySaved: boolean;
    }
  | { kind: 'incomplete' }
  | { kind: 'failed'; copy: TranslationKey };

/** A capture the server never answered for, or past its deadline. */
export const UNANSWERED_CAPTURE: CaptureOutcome = {
  kind: 'failed',
  copy: UNAVAILABLE,
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
    case RecipeCaptureStatus.Unavailable: {
      const { failure } = capture;
      return {
        kind: 'failed',
        copy:
          failure && isKnownFailure(failure)
            ? FAILURE_KEY[failure]
            : UNAVAILABLE,
      };
    }
  }
}

/** The inputs a refusal can name, as the sheets show them. */
export type CaptureField = Exclude<
  keyof CreateRecipeCaptureInput,
  'id' | 'locale'
>;

// Keyed by the input's fields, so one the schema adds fails to compile until placed.
const CAPTURE_FIELDS: Record<CaptureField, true> = {
  url: true,
  text: true,
  photos: true,
  sourceUrl: true,
};

const isCaptureField = (field: string): field is CaptureField =>
  Object.hasOwn(CAPTURE_FIELDS, field);

/**
 * What to do with the answer to a create: poll a capture still reading, settle
 * one a replay or a fast worker already finished, report a refusal (on its
 * field where it names one), wait out the daily allowance, or send again.
 */
export type CaptureCreateResult =
  | { kind: 'poll' }
  | { kind: 'settle'; outcome: CaptureOutcome }
  | { kind: 'refused'; field: CaptureField | null; error: unknown }
  | { kind: 'limited' }
  | { kind: 'resend' };

export function classifyCaptureCreate({
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
}): CaptureCreateResult {
  if (accepted) {
    const outcome = capture ? captureOutcomeOf(capture) : undefined;
    return outcome ? { kind: 'settle', outcome } : { kind: 'poll' };
  }
  if (dailyAllowanceWait(error) !== null) return { kind: 'limited' };
  // A refusal, in the payload or not, stands; one that never arrived does not.
  if (error === undefined || isVerdict(error)) {
    const field =
      refusedField !== null && isCaptureField(refusedField)
        ? refusedField
        : null;
    return { kind: 'refused', field, error };
  }
  return { kind: 'resend' };
}
