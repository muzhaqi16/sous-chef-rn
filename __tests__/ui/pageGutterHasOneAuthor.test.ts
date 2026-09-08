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

  // A screen whose loading or skeleton branch renders its children bare under
  // `gutter="none"`, where no list content container exists to inset them.
  'src/features/pantry/screens/PantryMain.tsx': 'insets its bare children',
  'src/features/recipes/screens/RecipeMain.tsx': 'insets its bare children',
  'src/features/mealPlan/screens/MealPlanMain.tsx': 'insets its bare children',
  'src/features/shoppingList/screens/ShoppingListMain.tsx': 'insets its bare children',
  'src/features/shoppingList/components/ShoppingListMainContent.tsx':
    'insets its bare children',

  // One host, which does not inset it.
  'src/features/shoppingList/components/ShoppingListTabs/FilterTabBar.tsx':
    'single host, self-inset',
  'src/features/shoppingList/components/skeletons/ShoppingListSkeleton.tsx':
    'single host, self-inset',
  'src/features/mealPlan/components/skeletons/MealPlanSkeleton.tsx':
    'single host, self-inset',
  'src/features/notifications/components/NotificationFilters.tsx':
    'single host, self-inset',
};

/**
 * Shared components that carry NO inset of their own, and the render sites that
 * therefore have to supply one. Derived from the tree rather than listed, so a
 * new host cannot ship flush to the screen edge — which is what
 * `NotificationFilters` and `SavedRecipes` did when `FilterTabs` gave its own
 * inset up.
 */
const GUTTERLESS = ['FilterTabs'];

/**
 * Hosts that supply the inset by POSITION rather than by a style of their own:
 * they render inside a container that is already padded, so adding one here
 * would double it.
 */
const INHERITS_AN_INSET: Record<string, string> = {
  'src/features/pantry/components/pantryDisplay/PantryStickyTabs.tsx':
    "row 0 of PantryContent's list, whose content container carries the gutter",
};

/**
 * A host supplies an inset when the render site sits inside something padded:
 * a wrapper reading the gutter token, a list content container, or a screen
 * that is not `gutter="none"`.
 */
const SUPPLIES_AN_INSET = /layout\.pageGutter|gutter="page"|styles\.gutter/;

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

  it('is not zeroed again by a file that owns it', () => {
    // A page container writing `paddingHorizontal: 0` opts out of the gutter it
    // is responsible for. An empty-list variant is the easy place to do it by
    // accident, and the whole header goes flush to the screen edge with it.
    const optedOut = Object.keys(AUTHORS)
      .filter(f => /\b(padding|margin)Horizontal:\s*0\b/.test(readFileSync(f, 'utf8')))
      .sort();

    expect(optedOut).toEqual([]);
  });

  it.each(GUTTERLESS)('every host of %s supplies the inset it does not', name => {
    // `<Name` followed by a tag character, so `<FilterTabsProps>` in a generic
    // is not read as a render site.
    const rendersIt = new RegExp(`<${name}[\\s<>/]`);
    const hosts = sources.filter(f => {
      if (f.includes('__tests__')) return false;
      if (f in INHERITS_AN_INSET) return false;
      return rendersIt.test(readFileSync(f, 'utf8')) && !f.includes(`/${name}/`);
    });

    expect(hosts.length).toBeGreaterThan(0);

    const bare = hosts
      .filter(f => !SUPPLIES_AN_INSET.test(readFileSync(f, 'utf8')))
      .sort();

    expect(bare).toEqual([]);
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
