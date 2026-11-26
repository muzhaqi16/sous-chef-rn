import * as ts from 'typescript';
import {
  calleeName,
  findProperty,
  jsxAttribute,
  jsxAttributeText,
  jsxElementsOf,
  nodesOf,
  parseSource,
  productionSources,
  propertyName,
} from '#/test-utils/sourceAst';

/**
 * gorhom's `BottomSheetView` is `position: absolute` with no bottom and no
 * height, so it bounds nothing. A scrollable inside it that sizes to its
 * parent gets the height of its own content instead and is never scrolled —
 * silently, and only once the person has more rows than the detent shows.
 * A sheet holding one uses `mode="list"`, which hands the child to the modal.
 */

const SCROLLABLES = new Set([
  'FlashList',
  'FlatList',
  'SectionList',
  'ScrollView',
]);

/** `styles.x`, in a plain, array or conditional style, as `x`. */
const styleKeys = (expression: ts.Expression): string[] =>
  nodesOf(expression)
    .filter(ts.isPropertyAccessExpression)
    .filter(
      access =>
        ts.isIdentifier(access.expression) &&
        /[sS]tyles\d*$/.test(access.expression.text),
    )
    .map(access => access.name.text);

/** Whether an object literal states `name` among its own properties. */
const states = (style: ts.ObjectLiteralExpression, name: string) =>
  style.properties.some(
    property =>
      ts.isPropertyAssignment(property) && propertyName(property.name) === name,
  );

const fillsItsParent = (style: ts.ObjectLiteralExpression) =>
  style.properties.some(
    property =>
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === 'flex' &&
      property.initializer.getText() === '1',
  );

/** The style `key` as the file's StyleSheet declares it. */
const styleEntry = (source: ts.SourceFile, key: string) =>
  nodesOf(source)
    .filter(ts.isCallExpression)
    .filter(call => calleeName(call) === 'StyleSheet.create')
    .map(call => findProperty(call, key))
    .find(Boolean);

/** Each scrollable style in a view-mode sheet's file that is never bounded. */
function unboundedScrollables(file: string, text?: string): string[] {
  const source = parseSource(file, text);
  const elements = jsxElementsOf(source);
  const hasViewSheet = elements.some(element => {
    const mode = jsxAttribute(element, 'mode');
    return (
      element.tagName.getText() === 'Sheet' &&
      !!mode &&
      jsxAttributeText(mode) === 'view'
    );
  });
  if (!hasViewSheet) return [];

  return elements
    .filter(element => SCROLLABLES.has(element.tagName.getText()))
    .flatMap(element => {
      const style = jsxAttribute(element, 'style')?.initializer;
      return style && ts.isJsxExpression(style) && style.expression
        ? styleKeys(style.expression)
        : [];
    })
    .filter(key => {
      const style = styleEntry(source, key)?.initializer;
      return (
        !!style &&
        ts.isObjectLiteralExpression(style) &&
        fillsItsParent(style) &&
        !states(style, 'maxHeight')
      );
    })
    .map(key => `${file} ${key}`);
}

const viewSheetFiles = productionSources('src/**/*.tsx').filter(file =>
  jsxElementsOf(parseSource(file)).some(element => {
    const mode = jsxAttribute(element, 'mode');
    return (
      element.tagName.getText() === 'Sheet' &&
      !!mode &&
      jsxAttributeText(mode) === 'view'
    );
  }),
);

describe('a view-mode sheet does not hold an unbounded scrollable', () => {
  it('catches a scrollable whose style is one of several', () => {
    const planted = `
      const Picker = () => (
        <Sheet mode="view" visible onDismiss={close}>
          <FlatList style={[styles.list, open && styles.open]} data={rows} />
        </Sheet>
      );
      const styles = StyleSheet.create(theme => ({
        list: { flex: 1 },
        open: { opacity: 1 },
      }));`;

    expect(unboundedScrollables('planted.tsx', planted)).toEqual([
      'planted.tsx list',
    ]);
  });

  it('finds the view-mode sheets to check', () => {
    // A rename that stops this matching would make every case below vacuous.
    expect(viewSheetFiles.length).toBeGreaterThan(0);
  });

  it('bounds every scrollable in them', () => {
    expect(viewSheetFiles.flatMap(file => unboundedScrollables(file))).toEqual(
      [],
    );
  });
});
