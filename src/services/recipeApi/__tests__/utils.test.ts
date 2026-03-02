import {
  transformSpoonacularToRecipeInput,
  transformSpoonacularIngredient,
  getSpoonacularIngredientImageUrl,
  getSpoonacularRecipeImageUrl,
  matchPantryItemsToIngredients,
  calculateRecipeMatchPercentage,
  formatCookingTime,
  parseDietaryRestrictions,
  parseIntolerances,
} from '../utils';

const mockRecipe = {
  id: 123,
  title: 'Test Pasta',
  summary: '<b>Delicious</b> pasta recipe',
  servings: 4,
  preparationMinutes: 10,
  cookingMinutes: 20,
  readyInMinutes: 30,
  image: 'https://example.com/pasta.jpg',
  sourceUrl: 'https://example.com/recipe',
  sourceName: 'TestSource',
  spoonacularSourceUrl: 'https://spoonacular.com/recipe-123',
  spoonacularScore: 85,
  healthScore: 70,
  pricePerServing: 200,
  vegetarian: true,
  vegan: false,
  glutenFree: true,
  dairyFree: false,
  ketogenic: false,
  whole30: false,
  cuisines: ['Italian'],
  dishTypes: ['dinner'],
  creditsText: 'Chef Test',
  analyzedInstructions: [{
    steps: [
      { number: 1, step: 'Boil water' },
      { number: 2, step: 'Cook pasta' },
    ],
  }],
  nutrition: {
    nutrients: [
      { name: 'Calories', amount: 350.5 },
      { name: 'Fat', amount: 12 },
    ],
  },
} as any;

const mockIngredient = {
  id: 1,
  name: 'Pasta',
  amount: 200,
  original: '200g pasta',
  aisle: 'Pasta & Grains',
  consistency: 'SOLID',
  measures: {
    metric: { amount: 200, unitShort: 'g' },
    us: { amount: 7, unitShort: 'oz' },
  },
  meta: ['al dente'],
  image: 'pasta.png',
} as any;

describe('recipeApi utils', () => {
  describe('transformSpoonacularToRecipeInput', () => {
    it('transforms basic recipe fields', () => {
      const result = transformSpoonacularToRecipeInput(mockRecipe);
      expect(result.name).toBe('Test Pasta');
      expect(result.servings).toBe(4);
      expect(result.prepTimeMinutes).toBe(10);
      expect(result.cookTimeMinutes).toBe(20);
      expect(result.totalTimeMinutes).toBe(30);
    });

    it('strips HTML from summary', () => {
      const result = transformSpoonacularToRecipeInput(mockRecipe);
      expect(result.description).toBe('Delicious pasta recipe');
      expect(result.description).not.toContain('<b>');
    });

    it('extracts dietary tags', () => {
      const result = transformSpoonacularToRecipeInput(mockRecipe);
      expect(result.dietaryTags).toContain('VEGETARIAN');
      expect(result.dietaryTags).toContain('GLUTEN_FREE');
      expect(result.dietaryTags).not.toContain('VEGAN');
    });

    it('rounds calories', () => {
      const result = transformSpoonacularToRecipeInput(mockRecipe);
      expect(result.caloriesPerServing).toBe(351);
    });

    it('extracts instructions', () => {
      const result = transformSpoonacularToRecipeInput(mockRecipe);
      expect(result.instructions).toHaveLength(2);
    });

    it('combines cuisines and dishTypes in tags', () => {
      const result = transformSpoonacularToRecipeInput(mockRecipe);
      expect(result.tags).toContain('Italian');
      expect(result.tags).toContain('dinner');
    });

    it('handles missing optional fields', () => {
      const minimal = { id: 1, title: 'Min', summary: '' } as any;
      const result = transformSpoonacularToRecipeInput(minimal);
      expect(result.name).toBe('Min');
      expect(result.prepTimeMinutes).toBeNull();
      expect(result.caloriesPerServing).toBeNull();
      expect(result.dietaryTags).toEqual([]);
    });

    it('sets default source when sourceName is missing', () => {
      const noSource = { ...mockRecipe, sourceName: undefined };
      const result = transformSpoonacularToRecipeInput(noSource);
      expect(result.source).toBe('Spoonacular');
    });
  });

  describe('transformSpoonacularIngredient', () => {
    it('transforms ingredient fields', () => {
      const result = transformSpoonacularIngredient(mockIngredient, 0);
      expect(result.name).toBe('Pasta');
      expect(result.quantity).toBe(200);
      expect(result.sortOrder).toBe(0);
      expect(result.originalString).toBe('200g pasta');
    });

    it('includes metric measurements', () => {
      const result = transformSpoonacularIngredient(mockIngredient, 0);
      expect(result.metricAmount).toBe(200);
      expect(result.metricUnit).toBe('g');
    });

    it('includes US measurements', () => {
      const result = transformSpoonacularIngredient(mockIngredient, 0);
      expect(result.usAmount).toBe(7);
      expect(result.usUnit).toBe('oz');
    });

    it('uses index as sortOrder', () => {
      expect(transformSpoonacularIngredient(mockIngredient, 5).sortOrder).toBe(5);
    });
  });

  describe('getSpoonacularIngredientImageUrl', () => {
    it('returns CDN URL', () => {
      expect(getSpoonacularIngredientImageUrl('pasta.png')).toBe(
        'https://spoonacular.com/cdn/ingredients_100x100/pasta.png',
      );
    });

    it('returns empty string for empty input', () => {
      expect(getSpoonacularIngredientImageUrl('')).toBe('');
    });
  });

  describe('getSpoonacularRecipeImageUrl', () => {
    it('returns image URL with default size', () => {
      expect(getSpoonacularRecipeImageUrl(123)).toBe(
        'https://spoonacular.com/recipeImages/123-636x393.jpg',
      );
    });

    it('returns image URL with custom size', () => {
      expect(getSpoonacularRecipeImageUrl(123, '240x150')).toBe(
        'https://spoonacular.com/recipeImages/123-240x150.jpg',
      );
    });
  });

  describe('matchPantryItemsToIngredients', () => {
    it('matches pantry items to ingredients', () => {
      const ingredients = [
        { id: 1, name: 'Pasta' },
        { id: 2, name: 'Tomato Sauce' },
      ] as any;
      const pantryItems = [
        { id: 'p1', name: 'pasta' },
        { id: 'p2', name: 'olive oil' },
      ];
      const matches = matchPantryItemsToIngredients(ingredients, pantryItems);
      expect(matches.get(1)).toEqual(['p1']);
      expect(matches.has(2)).toBe(false);
    });

    it('matches case-insensitively', () => {
      const ingredients = [{ id: 1, name: 'GARLIC' }] as any;
      const pantryItems = [{ id: 'p1', name: 'garlic' }];
      const matches = matchPantryItemsToIngredients(ingredients, pantryItems);
      expect(matches.get(1)).toEqual(['p1']);
    });

    it('matches partial names', () => {
      const ingredients = [{ id: 1, name: 'fresh tomatoes' }] as any;
      const pantryItems = [{ id: 'p1', name: 'tomatoes' }];
      const matches = matchPantryItemsToIngredients(ingredients, pantryItems);
      expect(matches.get(1)).toEqual(['p1']);
    });

    it('returns empty map when no matches', () => {
      const ingredients = [{ id: 1, name: 'saffron' }] as any;
      const pantryItems = [{ id: 'p1', name: 'salt' }];
      const matches = matchPantryItemsToIngredients(ingredients, pantryItems);
      expect(matches.size).toBe(0);
    });
  });

  describe('calculateRecipeMatchPercentage', () => {
    it('calculates percentage correctly', () => {
      expect(calculateRecipeMatchPercentage(10, 5)).toBe(50);
      expect(calculateRecipeMatchPercentage(3, 3)).toBe(100);
      expect(calculateRecipeMatchPercentage(4, 1)).toBe(25);
    });

    it('returns 0 for zero total', () => {
      expect(calculateRecipeMatchPercentage(0, 0)).toBe(0);
    });

    it('rounds to nearest integer', () => {
      expect(calculateRecipeMatchPercentage(3, 1)).toBe(33);
    });
  });

  describe('formatCookingTime', () => {
    it('formats minutes only', () => {
      expect(formatCookingTime(30)).toBe('30 min');
    });

    it('formats hours only', () => {
      expect(formatCookingTime(120)).toBe('2 hr');
    });

    it('formats hours and minutes', () => {
      expect(formatCookingTime(90)).toBe('1 hr 30 min');
    });

    it('returns N/A for null', () => {
      expect(formatCookingTime(null)).toBe('N/A');
    });

    it('returns N/A for 0', () => {
      expect(formatCookingTime(0)).toBe('N/A');
    });
  });

  describe('parseDietaryRestrictions', () => {
    it('maps restrictions to Spoonacular format', () => {
      expect(parseDietaryRestrictions(['VEGETARIAN', 'VEGAN'])).toBe(
        'vegetarian,vegan',
      );
    });

    it('filters unknown restrictions', () => {
      expect(parseDietaryRestrictions(['VEGETARIAN', 'UNKNOWN'])).toBe(
        'vegetarian',
      );
    });

    it('returns empty string for empty input', () => {
      expect(parseDietaryRestrictions([])).toBe('');
    });

    it('maps all known restrictions', () => {
      const all = ['VEGETARIAN', 'VEGAN', 'GLUTEN_FREE', 'DAIRY_FREE', 'KETO', 'PALEO', 'WHOLE30'];
      const result = parseDietaryRestrictions(all);
      expect(result).toBe('vegetarian,vegan,gluten free,dairy free,ketogenic,paleo,whole30');
    });
  });

  describe('parseIntolerances', () => {
    it('maps intolerances to Spoonacular format', () => {
      expect(parseIntolerances(['DAIRY', 'GLUTEN'])).toBe('dairy,gluten');
    });

    it('filters unknown intolerances', () => {
      expect(parseIntolerances(['DAIRY', 'UNKNOWN'])).toBe('dairy');
    });

    it('returns empty string for empty input', () => {
      expect(parseIntolerances([])).toBe('');
    });

    it('maps all known intolerances', () => {
      const all = ['DAIRY', 'EGG', 'GLUTEN', 'GRAIN', 'PEANUT', 'SEAFOOD', 'SESAME', 'SHELLFISH', 'SOY', 'SULFITE', 'TREE_NUT', 'WHEAT'];
      const result = parseIntolerances(all);
      expect(result).toContain('dairy');
      expect(result).toContain('tree nut');
      expect(result.split(',').length).toBe(12);
    });
  });
});
