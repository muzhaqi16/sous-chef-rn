import { Cuisine } from '#/graphql/generated/schemaTypes';
import type { TranslateFn } from '#/i18n';

export interface PopularCuisine {
  /** i18n key path — resolved by the consumer, which has the hook. */
  labelKey: string;
  value: Cuisine;
}

/** Every cuisine resolves through the same key path, popular or not. */
export const cuisineLabelKey = (value: Cuisine): string => `cuisines.${value}`;

export const POPULAR_CUISINES: PopularCuisine[] = [
  { labelKey: cuisineLabelKey(Cuisine.Italian), value: Cuisine.Italian },
  { labelKey: cuisineLabelKey(Cuisine.Mexican), value: Cuisine.Mexican },
  { labelKey: cuisineLabelKey(Cuisine.Chinese), value: Cuisine.Chinese },
  { labelKey: cuisineLabelKey(Cuisine.Japanese), value: Cuisine.Japanese },
  { labelKey: cuisineLabelKey(Cuisine.Indian), value: Cuisine.Indian },
  { labelKey: cuisineLabelKey(Cuisine.Thai), value: Cuisine.Thai },
  {
    labelKey: cuisineLabelKey(Cuisine.Mediterranean),
    value: Cuisine.Mediterranean,
  },
  { labelKey: cuisineLabelKey(Cuisine.American), value: Cuisine.American },
];

/**
 * Display label for a cuisine. Takes `t` because this is module scope — the
 * fallback is the title-cased enum name, so an unmapped cuisine still reads
 * as words rather than LATIN_AMERICAN.
 */
export const getCuisineLabel = (value: Cuisine, t: TranslateFn): string =>
  t(cuisineLabelKey(value), formatCuisineLabel(value));

// Helper function to get all cuisine options (popular + remaining)
export const getAllCuisineOptions = () => {
  const popularValues: Cuisine[] = POPULAR_CUISINES.map(c => c.value);
  const allCuisines = Object.values(Cuisine) as Cuisine[];

  const remainingCuisines = allCuisines
    .filter(c => !popularValues.includes(c))
    .map(value => ({
      labelKey: cuisineLabelKey(value),
      value,
    }));

  return [...POPULAR_CUISINES, ...remainingCuisines];
};

// Helper function to format enum value to readable label
const formatCuisineLabel = (value: Cuisine): string => {
  // Convert LATIN_AMERICAN -> Latin American, EASTERN_EUROPEAN -> Eastern European, etc.
  return value
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};
