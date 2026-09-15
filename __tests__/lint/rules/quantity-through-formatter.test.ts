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
    ],
  },
  'tsx',
);
