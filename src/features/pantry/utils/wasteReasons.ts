import type { TranslationKey } from '#i18n';
import { WasteReason } from '#graphql/generated/schemaTypes';

/** Why food went to waste, as every waste picker offers it, the likeliest first. */
export const WASTE_REASON_OPTIONS: ReadonlyArray<{
  labelKey: TranslationKey;
  value: WasteReason;
}> = [
  { labelKey: 'labels.expired', value: WasteReason.Expired },
  { labelKey: 'recordWaste.reasonSpoiled', value: WasteReason.Spoiled },
  { labelKey: 'labels.mold', value: WasteReason.Mold },
  { labelKey: 'labels.pest', value: WasteReason.Pest },
  { labelKey: 'labels.cookingFail', value: WasteReason.CookingFail },
  { labelKey: 'recordWaste.reasonSpilled', value: WasteReason.Spilled },
  { labelKey: 'recordWaste.reasonBurnt', value: WasteReason.Burnt },
  { labelKey: 'labels.overstock', value: WasteReason.Overstock },
  { labelKey: 'recordWaste.reasonBadTaste', value: WasteReason.Taste },
  { labelKey: 'labels.gaveAway', value: WasteReason.GaveAway },
  { labelKey: 'labels.unknownLoss', value: WasteReason.UnknownLoss },
  { labelKey: 'itemType.OTHER', value: WasteReason.Other },
];
