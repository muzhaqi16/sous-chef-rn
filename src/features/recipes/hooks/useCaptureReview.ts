import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { MeasurementRegionBasis } from '#/graphql/generated/schemaTypes';
import { useHeldCaptureId } from '#features/recipes/store/recipeCaptureStore';
import {
  CAPTURE_WARNING_KEY,
  MEASUREMENT_BASIS_KEY,
} from '#features/recipes/utils/recipeCaptureOutcome';
import { RecipeCaptureDocument } from './useRecipeCapture.generated';

/** A catalog item the capture proposed for a line it did not link. */
export interface CaptureCandidate {
  itemId: string;
  name: string;
}

/** A country code as its name in the reader's language, else the code. */
function regionName(code: string, language: string): string {
  try {
    return (
      new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/**
 * What a captured recipe's capture can still tell about it, while held: how
 * its measures were read, what the read warned of, and the items proposed for
 * each line it did not link, found by the line as written.
 */
export function useCaptureReview(recipeId: string | undefined) {
  const { t, i18n } = useTranslation();
  const captureId = useHeldCaptureId(recipeId);
  const { data } = useQuery(
    RecipeCaptureDocument,
    captureId
      ? {
          variables: { id: captureId },
          fetchPolicy: 'cache-first',
          // A finished capture does not change.
          refetchOn: false,
        }
      : skipToken,
  );
  const capture = data?.recipeCapture;
  if (!capture) return { review: null };

  const region = capture.measurementRegion;
  const measures = region
    ? t(MEASUREMENT_BASIS_KEY[region.basis], {
        region:
          region.basis === MeasurementRegionBasis.Default
            ? region.region
            : regionName(region.region, i18n.language),
      })
    : null;
  const warnings = [
    ...new Set(capture.warnings.map(warning => warning.code)),
  ].map(code => t(CAPTURE_WARNING_KEY[code]));

  const candidatesFor = (
    originalText: string | null | undefined,
  ): CaptureCandidate[] => {
    if (!originalText) return [];
    const line = capture.draft?.lines.find(
      entry => entry.originalText === originalText,
    );
    if (!line || line.item) return [];
    return line.candidates.map(candidate => ({
      itemId: candidate.item.id,
      name: candidate.item.name,
    }));
  };

  return { review: { measures, warnings, candidatesFor } };
}
