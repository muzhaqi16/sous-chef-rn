import type { FieldWriterTable } from '#/apollo/utils/fieldWriters';
import { writeHeldStock } from '#features/pantry/cache/stock';

/** A restored `heldQuantity` brings its display with it. */
export const PANTRY_FIELD_WRITERS: FieldWriterTable = {
  PantryItem: {
    heldQuantity: (cache, entityId, value) => {
      if (typeof value === 'number') writeHeldStock(cache, entityId, value);
    },
  },
};
