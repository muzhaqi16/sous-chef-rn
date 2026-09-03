import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Every sheet renders through the shell, or says why it does not.
 *
 * A `BottomSheetModal` rendered by hand is a sheet that has to re-derive what
 * the shell already settles: the backdrop claim, the snap points, the keyboard
 * host, and the header. Each of those has a documented failure the repo has
 * already paid for — a stranded backdrop that eats taps, a sheet blind to the
 * keyboard, a list that cannot scroll because it sits in a `BottomSheetView`.
 *
 * The 39 below predate the shell and are the adoption worklist. This guard is
 * not about them: it is about the FORTIETH, which would otherwise ship without
 * anyone deciding whether the shell fits.
 *
 * A type reference (`RefObject<BottomSheetModal>`, `BottomSheetModalProps`) is
 * not a render — the boundary assertions on either side are what keep
 * `useBottomSheetBackHandler` and the props types out.
 */

/** The shell itself, and the two surfaces task 8.1 folds into it. */
const SHELL = [
  'src/components/atoms/BottomSheetLayout.tsx',
  'src/components/templates/BottomSheetAction.tsx',
  'src/components/templates/ActionTray/ActionTray.tsx',
];

/**
 * Sheets that predate the shell. Each entry is one adoption, not an exemption:
 * the list may only SHRINK, and a sheet that leaves it must not come back.
 */
const PENDING_ADOPTION = [
  'src/components/modals/CookingPreferencesSheet/CookingPreferencesSheet.tsx',
  'src/components/modals/MacroTargetsSheet/MacroTargetsSheet.tsx',
  'src/components/modals/MarkCookedModal.tsx',
  'src/components/modals/NumberInputSheet/NumberInputSheet.tsx',
  'src/components/modals/TextEditBottomSheet/TextEditBottomSheet.tsx',
  'src/components/molecules/BottomSheetAutocompleteInput.tsx',
  'src/components/molecules/FolderPicker/ManageFolderSheet.tsx',
  'src/components/molecules/FolderPicker.tsx',
  'src/components/molecules/MultiSelectChipSheet/MultiSelectChipSheet.tsx',
  'src/components/molecules/SettingRow.tsx',
  'src/components/molecules/TagPicker.tsx',
  'src/components/organisms/StringArrayManager/StringArrayManager.tsx',
  'src/features/barcode/screens/SearchResultsScreen.tsx',
  'src/features/catalog/ui/AddItemSheet/AddItemSheet.tsx',
  'src/features/catalog/ui/AddStorageLocationSheet/AddStorageLocationSheet.tsx',
  'src/features/catalog/ui/StorageLocationSheet/StorageLocationSheet.tsx',
  'src/features/mealPlan/components/AddMealSheet.tsx',
  'src/features/mealPlan/components/AddToMealPlanSheet/AddToMealPlanSheet.tsx',
  'src/features/mealPlan/components/MealPlanSettingsSheet.tsx',
  'src/features/mealPlan/components/SaveAsTemplateSheet.tsx',
  'src/features/mealPlan/components/TemplateBrowserSheet.tsx',
  'src/features/mealPlan/components/TemplatePreviewSheet.tsx',
  'src/features/notifications/components/ExpirationActionSheet.tsx',
  'src/features/pantry/components/modals/AdjustQuantityModal.tsx',
  'src/features/pantry/components/modals/CorrectWeightModal.tsx',
  'src/features/pantry/components/modals/PantryActionModal.tsx',
  'src/features/recipes/components/WriteReviewSheet.tsx',
  'src/features/recipes/components/modals/IngredientMatchingSheet.tsx',
  'src/features/recipes/components/modals/ManageRecipeSheet/ManageRecipeSheet.tsx',
  'src/features/recipes/components/modals/SaveRecipeSheet/SaveRecipeSheet.tsx',
  'src/features/recipes/screens/RecipeForm/components/RecipeIngredientEditor.tsx',
  'src/features/recipes/screens/RecipeForm/components/RecipeStepEditor.tsx',
  'src/features/recipes/screens/RecipeSearch/IngredientSelectorSheet.tsx',
  'src/features/shoppingList/components/CollaboratorPermissionsBottomSheet.tsx',
  'src/features/shoppingList/components/PurchaseAmountSheet/PurchaseAmountSheet.tsx',
  'src/features/shoppingList/components/QuantityEditSheet/QuantityEditSheet.tsx',
  'src/features/shoppingList/components/moveToPantry/MoveToPantryModal.tsx',
];

const SRC = join(process.cwd(), 'src');

/**
 * A RENDER, not a type. The boundary on the left rejects `RefObject<Bottom…>`;
 * the one on the right rejects `BottomSheetModalProps`.
 */
const RENDERS_MODAL = /(?<![A-Za-z0-9_])<BottomSheetModal(?![A-Za-z0-9_])/;

/** Strip comments, so a docblock example does not read as a render. */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');

const collect = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') collect(full, found);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|generated)\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
};

const renderers = collect(SRC)
  .filter(file => RENDERS_MODAL.test(stripComments(readFileSync(file, 'utf8'))))
  .map(file => relative(process.cwd(), file))
  .sort();

describe('bottom sheet shell', () => {
  it('finds the renderers at all, so the checks below are not vacuous', () => {
    expect(renderers.length).toBeGreaterThanOrEqual(30);
  });

  it('every renderer is the shell or is on the adoption list', () => {
    const known = new Set([...SHELL, ...PENDING_ADOPTION]);
    const unaccounted = renderers.filter(file => !known.has(file));
    expect(unaccounted).toEqual([]);
  });

  it('the adoption list has no entry that already adopted the shell', () => {
    const stale = PENDING_ADOPTION.filter(file => !renderers.includes(file));
    // A sheet that adopted the shell leaves the list; leaving it behind turns
    // the worklist into a number nobody can act on.
    expect(stale).toEqual([]);
  });

  it('names the shell files that actually render a modal', () => {
    expect(SHELL.filter(file => renderers.includes(file))).toEqual(SHELL);
  });
});
