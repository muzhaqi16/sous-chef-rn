import type {
  ItemType,
  NetWeightKind,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import type { PhotoCreditValue } from '#/types/attribution';
import type { DataAttributionValue } from '#/types/attribution';
import type { ItemByLookupQuery } from './hooks/useSearchResults.generated';

/**
 * Where a scan started, and so what a result does: stock a pantry item or add a
 * shopping list line. A route param, so a string not a callback; it names the
 * features barcode serves, so it lives here, not in the shared navigation types.
 */
export type BarcodeSource = 'pantry' | 'shoppingList';

type LookupNode = ItemByLookupQuery['items']['edges'][number]['node'];

type UnitRef = Pick<
  NonNullable<LookupNode['displayUnit']>,
  'id' | 'name' | 'symbol'
>;

/**
 * A scan's result: the item a lookup found or the scan's new-item form created.
 * `canEdit`/`canSuggest` pick the edit action's wording (`writesItemDirectly`),
 * none if both are false; the edit sheet re-reads both from the item's snapshot.
 */
export interface ScannedItem
  extends Pick<LookupNode, 'id' | 'name' | 'canEdit' | 'canSuggest'> {
  description?: string;
  /** The primary photo's thumbnail, which an edit form starts from. */
  imageUrl?: string;
  /**
   * The card's full-width image: the primary photo's original, else
   * `imageUrl`, with the licence credit it needs.
   */
  image?: { url: string; credit?: PhotoCreditValue };
  /** The notices the item's catalog data asks a reader to see. */
  dataAttributions?: DataAttributionValue[];
  /** The code that was scanned, which is what the card shows. */
  upc: string;
  /**
   * The scanned barcode's product record. An add naming it stores the pack the
   * scan reported: its size, brand and barcode.
   */
  variationId?: string;
  /** Where that record's facts came from, e.g. `OPENFOODFACTS`. */
  source?: string;
  unitId?: string;
  /** The scanned barcode's own figure, in `displayUnit`. */
  netWeight?: number;
  /** What `netWeight` measures; only a PACKAGE figure is a package size. */
  netWeightKind?: NetWeightKind;
  displayUnit?: UnitRef;
  /** The unit an add naming no unit counts the row in. */
  trackingUnit?: UnitRef;
  /** The scanned barcode's own brand; never one picked from the item's list. */
  brandName?: string;
  brandId?: string;
  type?: ItemType;
  storageState?: StorageState;
  shelfLifeDays?: number;
  shelfLifeOpenedDays?: number;
  tags?: string[];
  categories?: Array<{ id: string; name: string; isPrimary?: boolean }>;
}
