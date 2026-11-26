import * as ts from 'typescript';
import {
  calleeName,
  jsxAttribute,
  jsxAttributeText,
  jsxElementsOf,
  lineOf,
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

/**
 * `decimal-pad` renders the DEVICE locale's separator, so a Spanish or Italian
 * phone offers `,` whatever the interface language is. `Number('25,50')` and
 * `parseFloat('25,50')` do not read that as 25.5 — the first is NaN and the
 * second silently truncates to 25 — and a save guarded on `!Number.isNaN`
 * then skips the write while the screen closes as though it saved.
 *
 * `parseDecimalInput` (or `parseFractionalInput` where fractions are allowed)
 * is the one converter that accepts both separators.
 */

/** Keypads that show the device's decimal separator. */
const SEPARATOR_KEYPADS = new Set(['decimal-pad', 'numeric']);
const BARE_PARSERS = new Set(['Number', 'parseFloat', 'Number.parseFloat']);
/** A field whose keypad sits in a child component, known by its name. */
const AMOUNT_NAME = /^(\w*(budget|price|amount|cost|quantity)\w*Input)$/i;

/** `x`, `x.trim()` or `x.replace(...)` as `x`; otherwise undefined. */
const parsedName = (arg: ts.Expression | undefined): string | undefined => {
  if (!arg) return undefined;
  if (ts.isIdentifier(arg)) return arg.text;
  if (
    ts.isCallExpression(arg) &&
    ts.isPropertyAccessExpression(arg.expression)
  ) {
    return parsedName(arg.expression.expression);
  }
  return undefined;
};

/** Each bare parse of a typed amount in one file, as `file:line name`. */
function bareParses(file: string, text?: string): string[] {
  const source = parseSource(file, text);
  const bound = new Set(
    jsxElementsOf(source).flatMap(element => {
      const keypad = jsxAttribute(element, 'keyboardType');
      const value = jsxAttribute(element, 'value');
      const keypadText = keypad && jsxAttributeText(keypad);
      const valueText = value && jsxAttributeText(value);
      return keypadText && SEPARATOR_KEYPADS.has(keypadText) && valueText
        ? [valueText]
        : [];
    }),
  );
  return nodesOf(source)
    .filter(ts.isCallExpression)
    .flatMap(call => {
      const name = parsedName(call.arguments[0]);
      const callee = calleeName(call);
      return name &&
        callee &&
        BARE_PARSERS.has(callee) &&
        (bound.has(name) || AMOUNT_NAME.test(name))
        ? [`${file}:${lineOf(call)} ${name}`]
        : [];
    });
}

describe('a user-typed amount is parsed with the device separator', () => {
  it('catches a parse of a decimal-pad value, whatever its name', () => {
    const planted = `
      const [rate, setRate] = useState('');
      const save = () => onSave(Number(rate.trim()));
      return <TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" />;`;

    expect(bareParses('planted.tsx', planted)).toEqual(['planted.tsx:3 rate']);
  });

  it('is never read with a bare Number() or parseFloat()', () => {
    // A new one means a field that silently drops fractional input on three of
    // the four locales this app ships.
    expect(productionSources().flatMap(file => bareParses(file))).toEqual([]);
  });

  it('finds the separator keypads it is meant to be checking', () => {
    const keypads = productionSources('src/**/*.tsx').flatMap(file =>
      jsxElementsOf(parseSource(file)).filter(element => {
        const keypad = jsxAttribute(element, 'keyboardType');
        const text = keypad && jsxAttributeText(keypad);
        return !!text && SEPARATOR_KEYPADS.has(text);
      }),
    );
    expect(keypads.length).toBeGreaterThan(3);
  });
});
