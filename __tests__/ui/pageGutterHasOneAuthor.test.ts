import { readFileSync } from 'fs';
import { sync as glob } from 'glob';

/**
 * The gutter had six authors on the pantry alone, agreeing only because the
 * same token was typed six times — which is how a second gutter token came to
 * sit beside this one at a different value. The container that knows it is a
 * page applies it; nothing inside does.
 */

/** Every file allowed to read the token, and what makes it a page container. */
const AUTHORS: Record<string, string> = {
  // The scroll container that IS the page: it gutters everything it renders,
  // its own header blocks and its rows alike.
  'src/components/organisms/ItemList.tsx': 'list owns its content inset',
  'src/features/pantry/components/PantryContent.tsx': 'list owns its content inset',
  'src/features/pantry/screens/FilteredPantryItems.tsx': 'list owns its content inset',
  'src/features/mealPlan/components/DayMealList.tsx': 'list owns its content inset',
  'src/features/recipes/screens/MyRecipes.tsx': 'list owns its content inset',
  'src/features/recipes/screens/SavedRecipes.tsx': 'list owns its content inset',
  'src/features/shoppingList/components/SortableShoppingList/SortableList.tsx':
    'list owns its content inset',

  // The scaffolds that apply `gutter="page"` for every screen not built on a list.
  'src/components/templates/Screen.tsx': 'the gutter prop itself',
  'src/components/templates/Sheet.tsx': 'the gutter prop itself',

  // Chrome rendered OUTSIDE a list, so its screen insets it rather than
  // inheriting one.
  'src/features/mealPlan/screens/MealPlanMain.tsx': 'chrome outside the list',
  'src/features/pantry/screens/PantryMain.tsx': 'chrome outside the list',
  'src/features/shoppingList/screens/ShoppingListMain.tsx': 'chrome outside the list',
  'src/features/shoppingList/components/ShoppingListMainContent.tsx':
    'chrome outside the list',
  'src/features/shoppingList/components/ShoppingListTabs/FilterTabBar.tsx':
    'chrome outside the list',

  // A skeleton stands in for a row, so it mirrors the inset of the list whose
  // rows it replaces — it is not rendered inside that list's content container.
  'src/features/pantry/components/PantryListSkeletonOverlay.tsx': 'stands in for rows',
  'src/features/pantry/components/skeletons/PantryScreenSkeleton.tsx':
    'stands in for rows',
  'src/features/recipes/components/skeletons/RecipeSkeleton.tsx': 'stands in for rows',
  'src/features/shoppingList/components/skeletons/ShoppingListSkeleton.tsx':
    'stands in for rows',

  // NEGATES the gutter its host applies, then re-applies it to the content: a
  // chip row scrolls out under the screen edge instead of stopping short of one.
  'src/components/organisms/FilterTabs/FilterTabs.tsx': 'negates it deliberately',
};

const sources = glob('src/**/*.{ts,tsx}', { ignore: ['**/*.generated.ts'] });

describe('the page gutter has one author per page', () => {
  it('is read only by a page container, its chrome, or a deliberate negation', () => {
    const readers = sources.filter(f =>
      readFileSync(f, 'utf8').includes('layout.pageGutter'),
    );
    const unlisted = readers.filter(f => !(f in AUTHORS)).sort();

    // A new reader is a new author of an edge. Add it to AUTHORS with the
    // reason it owns a page, or let the container that already does inset it.
    expect(unlisted).toEqual([]);
  });

  it('lists no author that has stopped reading it', () => {
    const stale = Object.keys(AUTHORS)
      .filter(f => {
        try {
          return !readFileSync(f, 'utf8').includes('layout.pageGutter');
        } catch {
          return true;
        }
      })
      .sort();

    expect(stale).toEqual([]);
  });

  it('is not applied by the shared row shell', () => {
    const src = readFileSync('src/styles/commonStyles.ts', 'utf8');
    const start = src.search(/\browWrapper:\s*\{/);
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('},', start));

    // An absence, not an equality: a row that insets itself is the second
    // author of an edge the list already owns.
    expect(body).not.toMatch(/\b(margin|padding)Horizontal\b/);
    expect(body).not.toMatch(/\b(margin|padding)(Left|Right|Start|End)\b/);
  });
});
