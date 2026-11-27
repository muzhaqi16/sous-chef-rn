import { readFileSync } from 'fs';
import * as ts from 'typescript';
import {
  jsxAttribute,
  jsxAttributeText,
  jsxElementsOf,
  lineOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

/**
 * A form sheet, or one that extends for the keyboard, has one stop. gorhom locks
 * a sheet's content below its top stop, so from a lower one it must move the
 * sheet for the keyboard, and the keyboard-aware scroll, which measured the
 * field before that move, carries it past where it belongs. Stops are spelled
 * out at the call so this can read them.
 * Verified: #gorhoms-lift-and-a-keyboard-aware-scroll-both-make-room
 */
const attributeIs = (
  element: ts.JsxOpeningLikeElement,
  name: string,
  value: string,
) => {
  const attribute = jsxAttribute(element, name);
  return !!attribute && jsxAttributeText(attribute) === value;
};

const formSheetStops = (file: string, text?: string) =>
  jsxElementsOf(parseSource(file, text))
    .filter(
      element =>
        element.tagName.getText() === 'Sheet' &&
        (attributeIs(element, 'mode', 'form') ||
          attributeIs(element, 'keyboardBehavior', 'extend')),
    )
    .map(element => {
      const value = jsxAttribute(element, 'snapPoints')?.initializer;
      const points =
        value && ts.isJsxExpression(value) ? value.expression : undefined;
      return {
        line: lineOf(element),
        stops:
          points && ts.isArrayLiteralExpression(points)
            ? points.elements.length
            : undefined,
      };
    });

describe('a form sheet', () => {
  it('names one stop', () => {
    const offenders = productionSources()
      .map(file => ({ file, text: readFileSync(file, 'utf8') }))
      .filter(({ text }) => /mode="form"|keyboardBehavior="extend"/.test(text))
      .flatMap(({ file, text }) =>
        formSheetStops(file, text)
          .filter(({ stops }) => stops !== 1)
          .map(({ line }) => `${file}:${line}`),
      );

    expect(offenders).toEqual([]);
  });

  it('is caught with a second stop, or with stops it does not spell out', () => {
    expect(
      formSheetStops(
        'planted.tsx',
        "<Sheet mode=\"form\" snapPoints={['65%', '85%']} />",
      ),
    ).toEqual([{ line: 1, stops: 2 }]);
    expect(
      formSheetStops(
        'planted.tsx',
        '<Sheet mode="form" snapPoints={points} />',
      ),
    ).toEqual([{ line: 1, stops: undefined }]);
    expect(
      formSheetStops(
        'planted.tsx',
        '<Sheet mode="list" keyboardBehavior="extend" snapPoints={[\'70%\', \'95%\']} />',
      ),
    ).toEqual([{ line: 1, stops: 2 }]);
    expect(
      formSheetStops(
        'planted.tsx',
        "<Sheet mode=\"list\" snapPoints={['70%', '95%']} />",
      ),
    ).toEqual([]);
  });
});
