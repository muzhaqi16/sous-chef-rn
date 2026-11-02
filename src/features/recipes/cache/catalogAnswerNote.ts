import type { AnswerNote } from '#/apollo/links/answerNotesLink';
import { isRecord } from '#/utils/isRecord';
import {
  catalogFetchKey,
  recordCatalogFetch,
  type CatalogField,
} from '#features/recipes/store/catalogFetchTimes';

const CATALOG_FIELDS: readonly CatalogField[] = [
  'catalogRecipesByIngredients',
  'randomCatalogRecipes',
];

/** A complete catalog page records when it arrived, which decides when a read asks again. */
export const noteCatalogAnswer: AnswerNote = (data, variables) => {
  for (const field of CATALOG_FIELDS) {
    const page = data[field];
    if (isRecord(page) && page.catalogAvailable !== false) {
      recordCatalogFetch(catalogFetchKey(field, variables), Date.now());
    }
  }
};
