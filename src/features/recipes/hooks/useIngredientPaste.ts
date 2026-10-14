import { useLazyQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';
import { getDeviceLocale } from '#/utils/deviceLocale';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import {
  isFeatureDisabled,
  isPremiumRequired,
} from '#domain/serverJobRefusals';
import { ParseIngredientLinesDocument } from './useIngredientPaste.generated';
import {
  toPastedIngredient,
  type PastedIngredient,
} from '#features/recipes/utils/pastedIngredients';

/**
 * Reads pasted ingredient lines through the server's parser, which resolves
 * units by region and names catalog items. Needs the API; writes nothing.
 */
export function useIngredientPaste() {
  const { t } = useTranslation();
  const unavailable = useIsApiUnavailable();
  const [parse, { loading }] = useLazyQuery(ParseIngredientLinesDocument, {
    fetchPolicy: 'no-cache',
    refetchOn: false,
  });

  const failureCopy = (error: unknown) => {
    if (isFeatureDisabled(error)) return t('errors.codes.featureDisabled');
    if (isPremiumRequired(error)) return t('errors.codes.premiumRequired');
    return t('recipes.pasteIngredientsFailed');
  };

  /** The lines as form rows, in order; null after a failure it has reported. */
  const parseLines = async (
    lines: readonly string[],
  ): Promise<PastedIngredient[] | null> => {
    const locale = getDeviceLocale();
    // Built before the try: a value block inside one stops the compiler.
    const input = { lines: [...lines], ...(locale && { locale }) };
    let result;
    try {
      result = await parse({ variables: { input } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Parse pasted ingredient lines',
      });
    }
    const parsed = result?.data?.parseIngredientLines.lines;
    if (!parsed) {
      toastService.error(failureCopy(result?.error));
      return null;
    }
    return parsed.map(toPastedIngredient);
  };

  return { parseLines, parsing: loading, unavailable };
}
