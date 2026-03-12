import { Cuisine } from '#generated';

export interface PopularCuisine {
  label: string;
  value: Cuisine;
}

export const POPULAR_CUISINES: PopularCuisine[] = [
  { label: 'Italian', value: Cuisine.Italian },
  { label: 'Mexican', value: Cuisine.Mexican },
  { label: 'Chinese', value: Cuisine.Chinese },
  { label: 'Japanese', value: Cuisine.Japanese },
  { label: 'Indian', value: Cuisine.Indian },
  { label: 'Thai', value: Cuisine.Thai },
  { label: 'Mediterranean', value: Cuisine.Mediterranean },
  { label: 'American', value: Cuisine.American },
];

// Helper function to convert enum value to display label
export const getCuisineLabel = (value: Cuisine): string => {
  const cuisine = POPULAR_CUISINES.find((c) => c.value === value);
  return cuisine?.label || value;
};

// Helper function to get all cuisine options (popular + remaining)
export const getAllCuisineOptions = () => {
  const popularValues = POPULAR_CUISINES.map((c) => c.value);
  const allCuisines = Object.values(Cuisine) as Cuisine[];

  const remainingCuisines = allCuisines
    .filter((c) => !popularValues.includes(c as any))
    .map((value) => ({
      label: formatCuisineLabel(value),
      value,
    }));

  return [...POPULAR_CUISINES, ...remainingCuisines];
};

// Helper function to format enum value to readable label
const formatCuisineLabel = (value: Cuisine): string => {
  // Convert LATIN_AMERICAN -> Latin American, EASTERN_EUROPEAN -> Eastern European, etc.
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};
