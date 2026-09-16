import { testTypedRule } from '#/test-utils/eslintRuleTester';

const PRELUDE = `declare const Text: (props: { children?: unknown }) => null;
declare const Chip: (props: { label?: string; testID?: string }) => null;
declare const t: (key: string, options?: Record<string, unknown>) => string;
declare const toastService: { show: (message: string) => void };
declare const logger: { info: (...args: unknown[]) => void };
declare function formatQuantityForDisplay(value: number): string;
declare function formatDate(value: string): string;
declare function money(value: number): string;
declare const count: number;
declare const total: number | undefined;
declare const label: string;
declare const node: string | number | null;
declare const unit: { symbol: string; name: string };
declare const unitSymbol: string;
declare const createdAt: string;
declare const price: number;
declare const id: string;
`;

const code = (body: string) => `${PRELUDE}${body}\n`;

testTypedRule(
  'no-number-noun-concat',
  {
    valid: [
      // One key holds the sentence and picks the plural form.
      code("export const a = <Text>{t('items.count', { count })}</Text>;"),
      // A formatted quantity beside its unit symbol: "1 1/4 cup".
      code(
        'export const a = <Text>{formatQuantityForDisplay(count)} {unit.symbol}</Text>;',
      ),
      code('export const a = <Text>{count} {unitSymbol}</Text>;'),
      code(
        'export const a = <Chip label={`${formatQuantityForDisplay(count)} ${unit.symbol}`} />;',
      ),
      // Separators, percentages and ranges carry no word.
      code('export const a = <Text>{count} · {label}</Text>;'),
      code("export const a = <Text>{count}{' · '}{label}</Text>;"),
      code('export const a = <Text>{count}%</Text>;'),
      code('export const a = <Text>{count}/{price}</Text>;'),
      code('export const a = <Chip label={`${count}/${price}`} />;'),
      code("export const a = <Text>{t('labels.total')}: {count}</Text>;"),
      // A date, a time or money beside a number.
      code('export const a = <Text>{count} {formatDate(createdAt)}</Text>;'),
      code('export const a = <Text>{count} × {money(price)}</Text>;'),
      // Two numbers, or a node that may be an element.
      code('export const a = <Text>{count} {price}</Text>;'),
      code('export const a = <Text>{count} {node}</Text>;'),
      // Not shown: a key, a testID, a log line.
      code('export const key = `${count}-${id}`;'),
      code('export const a = <Chip testID={`${count} ${label}`} />;'),
      code('logger.info(`${count} ${label}`);'),
      // A unit reached through a conditional, a holder or a helper.
      code(
        "export const a = <Text>{formatQuantityForDisplay(count)}{unit.symbol ? ` ${unit.symbol}` : ''}</Text>;",
      ),
      code('export const a = <Text>{count} {unit.name}</Text>;'),
      code(
        'declare function getUnitDisplayText(u: { symbol: string }): string;\nexport const quantityText = `${count} ${getUnitDisplayText(unit)}`;',
      ),
      // A unit symbol written as a literal: "250g", "(5s)", "1.5 kg".
      code('export const formatGrams = (grams: number) => `${grams}g`;'),
      code('export const a = <Chip label={`${label} (${count}s)`} />;'),
      code(
        "export const formatWeight = (grams: number, liquid: boolean) => `${(grams / 1000).toFixed(1)} ${liquid ? 'L' : 'kg'}`;",
      ),
      // A translated prefix before the number carries its own punctuation.
      code(
        "export const a = <Text>{t('restock.newQuantityPrefix')}{count}</Text>;",
      ),
      // A composed string that only reaches a logger.
      code('const summary = `attempt ${count} failed`;\nlogger.info(summary);'),
      // Arithmetic, not concatenation.
      code('export const sum = count + price;'),
      // An element between them breaks the run.
      code('export const a = <Text>{count}<Text>{label}</Text></Text>;'),
    ],
    invalid: [
      {
        code: code('export const a = <Text>{count} {label}</Text>;'),
        errors: ['concatenated'],
      },
      {
        code: code("export const a = <Text>{count}{' '}{label}</Text>;"),
        errors: ['concatenated'],
      },
      {
        code: code(
          "export const a = <Text>{total} {t('recipes.ingredientsSuffix')}</Text>;",
        ),
        errors: ['concatenated'],
      },
      {
        code: code('export const a = <Text>{count} items</Text>;'),
        errors: ['concatenated'],
      },
      {
        code: code('export const a = <Chip label={`Item ${count}`} />;'),
        errors: ['concatenated'],
      },
      {
        code: code(
          "export const a = <Text>{count === 0 ? t('none') : `${count} selected`}</Text>;",
        ),
        errors: ['concatenated'],
      },
      {
        code: code(
          "declare function firstNonBlank(v: string | null): string | undefined;\ndeclare const capacityUnit: string | null;\nexport const a = <Text>/ {count}{' '}{firstNonBlank(capacityUnit) ?? t('labels.units')}</Text>;",
        ),
        errors: ['concatenated'],
      },
      {
        code: code(
          "export const a = <Text>{Math.round(price)}{t('recipes.percentHealthy')}</Text>;",
        ),
        errors: ['concatenated'],
      },
      {
        code: code(
          "export const a = <Chip label={`${count} ${t('recipes.minutes')}`} />;",
        ),
        errors: ['concatenated'],
      },
      {
        code: code('export const a = <Text>{`${count} ${label}`}</Text>;'),
        errors: ['concatenated'],
      },
      {
        code: code(
          "export const a = <Text>{formatQuantityForDisplay(count)} {t('recipes.cups')}</Text>;",
        ),
        errors: ['concatenated'],
      },
      {
        code: code(
          "export const a = t('plan.summary', { meals: `${count} ${label}` });",
        ),
        errors: ['concatenated'],
      },
      {
        code: code("toastService.show(count + ' ' + label);"),
        errors: ['concatenated'],
      },
      {
        code: code('toastService.show(`${count} items removed`);'),
        errors: ['concatenated'],
      },
      {
        code: code(
          'const summary = `${count} ${label}`;\nexport const a = <Text>{summary}</Text>;',
        ),
        errors: ['concatenated'],
      },
      {
        code: code(
          'const shown = `${count.toFixed(1)} ${label}`;\nexport const a = <Text>{shown}</Text>;',
        ),
        errors: ['concatenated'],
      },
    ],
  },
  'tsx',
);
