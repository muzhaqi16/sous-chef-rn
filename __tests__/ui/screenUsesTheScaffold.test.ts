import { readFileSync } from 'fs';
import { sync as glob } from 'glob';
import ts from 'typescript';

/**
 * A screen's chrome, back control, gutter and safe-area insets come from one
 * scaffold, so moving between screens never moves the arrow or the content
 * edge. Six profile screens once put their back button at four x-positions
 * because each assembled its own header.
 */

/** `Screen` and the presets built on it. */
const SCAFFOLDS = [
  'Screen',
  'SubScreen',
  'FormScreen',
  'DetailTemplate',
  'PaginatedHistoryScreen',
  'CollapsingHeroDetail',
  'AuthWrapper',
  'OnBoardingWrapper',
];

/** A screen file that renders no scaffold itself, and why. */
const EXEMPT: Record<string, string> = {
  'src/features/barcode/screens/BarcodeScannerScreen.tsx':
    'full-bleed camera preview, no chrome by design',
  'src/features/pantry/screens/PantryItemScreen.tsx':
    'delegates to PantryItemForm, which renders FormScreen',
};

/** Files other than the scaffold that may render the Header organism: sheets. */
const HEADER_OUTSIDE_SCAFFOLD: Record<string, string> = {
  'src/features/recipes/components/recipeForm/RecipeStepEditor.tsx': 'sheet',
  'src/features/recipes/components/recipeForm/RecipeIngredientEditor.tsx':
    'sheet',
  'src/features/catalog/components/BottomSheetAutocompleteInput.tsx': 'sheet',
  'src/features/shoppingList/components/moveToPantry/MoveToPantryModal.tsx':
    'sheet',
  'src/features/shoppingList/components/QuantityEditSheet/QuantityEditSheet.tsx':
    'sheet',
  'src/features/shoppingList/components/PurchaseAmountSheet/PurchaseAmountSheet.tsx':
    'sheet',
};

const read = (file: string) => readFileSync(file, 'utf8');
const parse = (file: string) =>
  ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);

const jsxTagsIn = (source: ts.SourceFile) => {
  const tags: Array<ts.JsxOpeningElement | ts.JsxSelfClosingElement> = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      tags.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return tags;
};

const stringAttribute = (
  tag: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
) => {
  for (const attribute of tag.attributes.properties) {
    if (
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText() === name &&
      attribute.initializer &&
      ts.isStringLiteral(attribute.initializer)
    ) {
      return attribute.initializer.text;
    }
  }
  return undefined;
};

const screenFiles = glob('src/features/*/screens/**/*.tsx', {
  ignore: ['**/__tests__/**'],
});
const featureFiles = glob('src/features/**/*.tsx', {
  ignore: ['**/__tests__/**'],
});
const appFiles = glob('src/**/*.tsx', { ignore: ['**/__tests__/**'] });

describe('every screen is built on the scaffold', () => {
  it('renders Screen or a preset over it', () => {
    const bare = screenFiles
      .filter(file => !(file in EXEMPT))
      .filter(
        file =>
          !jsxTagsIn(parse(file)).some(tag =>
            SCAFFOLDS.includes(tag.tagName.getText()),
          ),
      )
      .sort();

    // Build it on `Screen` (or `SubScreen` for a pushed screen), or add it to
    // EXEMPT with the reason it has no chrome.
    expect(bare).toEqual([]);
  });

  it('assembles no header, back control or safe area of its own', () => {
    const offenders = featureFiles
      .filter(file =>
        /from '#components\/atoms\/BackButton'|SafeAreaView\b/.test(read(file)),
      )
      .sort();

    expect(offenders).toEqual([]);
  });

  it('leaves the Header organism to the scaffold and to sheets', () => {
    const importers = appFiles
      .filter(file => read(file).includes("organisms/Header'"))
      .filter(file => !file.startsWith('src/components/templates/'))
      .filter(file => !(file in HEADER_OUTSIDE_SCAFFOLD))
      .sort();

    expect(importers).toEqual([]);
  });

  it('turns the gutter off only where a list owns its inset', () => {
    const offenders = appFiles.flatMap(file =>
      jsxTagsIn(parse(file))
        .filter(tag => ['Screen', 'SubScreen'].includes(tag.tagName.getText()))
        .filter(
          tag =>
            stringAttribute(tag, 'gutter') === 'none' &&
            stringAttribute(tag, 'scroll') !== 'list',
        )
        .map(tag => {
          const { line } = tag
            .getSourceFile()
            .getLineAndCharacterOfPosition(tag.getStart());
          return `${file}:${line + 1}`;
        }),
    );

    // A screen that does not render a list takes the page gutter.
    expect(offenders).toEqual([]);
  });

  it('lists no exemption that has stopped applying', () => {
    const stale = [
      ...Object.keys(EXEMPT).filter(file =>
        jsxTagsIn(parse(file)).some(tag =>
          SCAFFOLDS.includes(tag.tagName.getText()),
        ),
      ),
      ...Object.keys(HEADER_OUTSIDE_SCAFFOLD).filter(
        file => !read(file).includes("organisms/Header'"),
      ),
    ].sort();

    expect(stale).toEqual([]);
  });
});
