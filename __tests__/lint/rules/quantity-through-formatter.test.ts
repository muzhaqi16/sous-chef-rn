import { testTypedRule } from '#/test-utils/eslintRuleTester';

const DECLARE = [
  'declare const Text: (props: { children?: unknown; label?: string; value?: number }) => null;',
  'declare function t(key: string, options?: Record<string, unknown>): string;',
  'declare function formatQuantityForDisplay(value: number | null | undefined): string;',
  'declare const item: { quantity: number; minQuantity: number | null; amount: number; name: string; quantityInput: string; count: number };',
  'declare const unit: { totalQuantity: number; symbol: string };',
  'declare const qty: number;',
  'declare const price: number;',
].join('\n');

const withTypes = (code: string) => `${DECLARE}\n${code}`;

const FOLLOW = [{ followVariables: true }];

testTypedRule(
  'quantity-through-formatter',
  {
    valid: [
      // Wrapped in a call: the formatter's result is text.
      withTypes(
        'export const a = <Text>{formatQuantityForDisplay(item.quantity)}</Text>;',
      ),
      withTypes(
        'export const b = <Text label={`${formatQuantityForDisplay(item.quantity)} ${unit.symbol}`} />;',
      ),
      withTypes(
        "export const c = t('remaining', { quantity: formatQuantityForDisplay(item.quantity) });",
      ),
      // Not named like a quantity: money and counts are not this rule's.
      withTypes('export const d = <Text>{price}</Text>;'),
      // A string, not a number.
      withTypes('export const e = <Text>{item.quantityInput}</Text>;'),
      // A number-typed prop is handed on, not shown.
      withTypes('export const f = <Text value={item.quantity} />;'),
      // A guard on the left of `&&` is not rendered text.
      withTypes('export const g = <Text>{qty > 0 && item.name}</Text>;'),
      // i18next picks the plural form from `count`, which must stay a number.
      withTypes("export const h = t('items', { count: item.quantity });"),
      // A template literal outside JSX and outside `t` is not this rule's slot.
      withTypes('export const key = `${item.quantity}|${unit.symbol}`;'),
      // Compared, not rendered.
      withTypes('export const i = item.quantity === qty;'),
      // Without the option an intermediate `const` is not followed.
      withTypes(
        'const shown = item.quantity * 2;\nexport const j = <Text>{shown}</Text>;',
      ),
      // Followed, but formatted where the `const` is built.
      {
        code: withTypes(
          'const shown = formatQuantityForDisplay(item.quantity);\nexport const k = <Text>{shown}</Text>;',
        ),
        options: FOLLOW,
      },
      // Followed, but built from a count or money, not a quantity.
      {
        code: withTypes(
          'const total = price * 2;\nexport const l = <Text>{total}</Text>;',
        ),
        options: FOLLOW,
      },
      // A `let` can be reassigned to a formatted value before it renders.
      {
        code: withTypes(
          'let shown = item.quantity;\nshown = 1;\nexport const m = <Text>{shown}</Text>;',
        ),
        options: FOLLOW,
      },
      // Followed into a number-typed prop: handed on, not shown.
      {
        code: withTypes(
          'const shown = item.quantity;\nexport const n = <Text value={shown} />;',
        ),
        options: FOLLOW,
      },
    ],
    invalid: [
      {
        code: withTypes('export const a = <Text>{item.quantity}</Text>;'),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes(
          'export const b = <Text>{unit.totalQuantity} {unit.symbol}</Text>;',
        ),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes(
          'export const c = <Text label={`${item.minQuantity} ${unit.symbol}`} />;',
        ),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes(
          'export const d = <Text>{`${qty} ${unit.symbol} remaining`}</Text>;',
        ),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes(
          "export const e = t('discard', { quantity: item.quantity, name: item.name });",
        ),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes(
          "export const f = t('matched', { amount: `${item.amount} ${unit.symbol}` });",
        ),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes(
          'export const g = <Text>{item.minQuantity ?? 0}</Text>;',
        ),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes('export const h = <Text>-{qty * 2}</Text>;'),
        errors: ['rawQuantity'],
      },
      {
        code: withTypes(
          'const shown = item.quantity * 2;\nexport const i = <Text>{shown}</Text>;',
        ),
        options: FOLLOW,
        errors: ['rawQuantityVariable'],
      },
      {
        code: withTypes(
          'const line = `${unit.totalQuantity} ${unit.symbol}`;\nexport const j = <Text label={line} />;',
        ),
        options: FOLLOW,
        errors: ['rawQuantityVariable'],
      },
      {
        code: withTypes(
          "const base = item.minQuantity ?? 0;\nconst shown = base;\nexport const k = t('remaining', { left: shown });",
        ),
        options: FOLLOW,
        errors: ['rawQuantityVariable'],
      },
      {
        code: withTypes(
          'export function Row() {\n  const left = qty - item.amount;\n  return <Text>{left > 0 ? left : 0}</Text>;\n}',
        ),
        options: FOLLOW,
        errors: ['rawQuantityVariable'],
      },
    ],
  },
  'tsx',
);
