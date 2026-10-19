import { useLazyQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { toastService } from '#/services/toastService';
import { errorCopy, errorService } from '#/services/errorService';
import { getDeviceLocale } from '#/utils/deviceLocale';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
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
      toastService.error(
        errorCopy(result?.error, t, t('recipes.pasteIngredientsFailed')),
      );
      return null;
    }
    return parsed.map(toPastedIngredient);
  };

  return { parseLines, parsing: loading, unavailable };
}
