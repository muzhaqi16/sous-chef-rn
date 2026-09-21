import { Cuisine } from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';

export interface PopularCuisine {
  /** i18n key path — resolved by the consumer, which has the hook. */
  labelKey: TranslationKey;
  value: Cuisine;
}

/** Every cuisine resolves through the same key path, popular or not. */
export const cuisineLabelKey = (value: Cuisine): `cuisines.${Cuisine}` =>
  `cuisines.${value}`;

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

// Helper function to get all cuisine options (popular + remaining)
export const getAllCuisineOptions = () => {
  const popularValues: Cuisine[] = POPULAR_CUISINES.map(c => c.value);
  const allCuisines = Object.values(Cuisine);

  const remainingCuisines = allCuisines
    .filter(c => !popularValues.includes(c))
    .map(value => ({
      labelKey: cuisineLabelKey(value),
      value,
    }));

  return [...POPULAR_CUISINES, ...remainingCuisines];
};
