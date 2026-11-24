import { readFileSync } from 'fs';
import { sync as glob } from 'glob';
import ts from 'typescript';

/**
 * A sheet's bar never scrolls. With the keyboard up, a field scrolled into view
 * carried a header in the content off the top, and Confirm took one tap to
 * close the keyboard before a second confirmed. The bar goes in `Sheet`'s
 * `header`, in `SheetHeaderSlot` from content that owns its handlers, or above
 * the scrollable in a sheet that lays itself out.
 */

const BARS = new Set(['SheetHeader']);

/** What scrolls its children; a bar inside one scrolls with them. */
const SCROLLERS = new Set([
  'ScrollView',
  'BottomSheetScrollView',
  'BottomSheetFormScrollView',
  'BottomSheetKeyboardAwareScrollView',
  'KeyboardAwareScrollView',
  'FlatList',
  'FlashList',
  'BottomSheetFlatList',
]);

const tagName = (node: ts.JsxElement | ts.JsxOpeningLikeElement) =>
  (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText();

/** Where a bar sits that moves with the content, or null where it holds. */
function scrollingPlace(bar: ts.Node): string | null {
  for (let node = bar.parent; !ts.isSourceFile(node); node = node.parent) {
    if (ts.isJsxAttribute(node)) {
      const owner = tagName(node.parent.parent);
      const prop = node.name.getText();
      return prop === 'header' ? null : `${owner}'s ${prop}`;
    }
    if (ts.isJsxElement(node)) {
      const name = tagName(node);
      if (name === 'SheetHeaderSlot') return null;
      if (SCROLLERS.has(name)) return `inside ${name}`;
      if (name === 'Sheet') return "Sheet's children";
    }
  }
  return null;
}

const files = glob('src/**/*.tsx', {
  ignore: ['**/__tests__/**', 'src/components/templates/SheetHeader.tsx'],
});

it('holds every sheet bar above the content that scrolls', () => {
  const misplaced: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!/<SheetHeader\b/.test(text)) continue;
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) &&
        BARS.has(tagName(node))
      ) {
        const place = scrollingPlace(node);
        if (place) misplaced.push(`${file}: ${tagName(node)} ${place}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(misplaced).toEqual([]);
});
