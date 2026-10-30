import { testTypedRule } from '#/test-utils/eslintRuleTester';

const PRELUDE = `import { MealType, InviteStatus } from '#/graphql/generated/schemaTypes';
declare const Text: (props: { children?: unknown }) => null;
declare const Chip: (props: { label?: string; value?: string }) => null;
declare const toastService: { show: (title: string) => void };
declare const t: (key: string, options?: Record<string, unknown>) => string;
declare const logger: { info: (...args: unknown[]) => void };
declare const mealType: MealType;
declare const status: InviteStatus | null;
declare const name: string;
declare function formatLabel(value: string): string;
declare function statusLabel(value: InviteStatus): string;
`;

const code = (body: string) => `${PRELUDE}${body}\n`;

testTypedRule(
  'no-rendered-enum',
  {
    valid: [
      // The key is composed from the enum; the key type checks it.
      code('export const a = <Text>{t(`mealType.${mealType}`)}</Text>;'),
      // A non-copy prop takes the identifier.
      code('export const a = <Chip value={mealType} />;'),
      // A plain string renders as-is.
      code('export const a = <Text>{name}</Text>;'),
      // Compared or sent on, not shown.
      code("export const isFrozen = mealType.toLowerCase() === 'dinner';"),
      code('export const param = mealType.toLowerCase();'),
      // A formatter typed with the enum owns its table.
      code(
        'export const a = <Text>{statusLabel(InviteStatus.Pending)}</Text>;',
      ),
      // Developer-facing.
      code('logger.info(`meal ${mealType}`);'),
      code('export const key = `${mealType}-row`;'),
    ],
    invalid: [
      {
        code: code('export const a = <Text>{mealType}</Text>;'),
        errors: ['rendered'],
      },
      {
        code: code('export const a = <Text>{status ?? name}</Text>;'),
        errors: ['rendered'],
      },
      {
        code: code('export const a = <Chip label={mealType} />;'),
        errors: ['rendered'],
      },
      {
        code: code(
          'export const option = { label: mealType, value: mealType };',
        ),
        errors: ['rendered'],
      },
      {
        code: code("export const a = t('plan.summary', { meal: mealType });"),
        errors: ['rendered'],
      },
      {
        code: code('toastService.show(`Now ${mealType}`);'),
        errors: ['rendered'],
      },
      {
        code: code(
          'export const a = mealType.charAt(0) + mealType.slice(1).toLowerCase();',
        ),
        errors: ['transformed', 'transformed'],
      },
      {
        code: code(
          "export const a = <Text>{mealType.replace('_', ' ')}</Text>;",
        ),
        errors: ['transformed'],
      },
      {
        code: code('export const a = <Text>{formatLabel(mealType)}</Text>;'),
        errors: ['widened'],
      },
      {
        code: code(
          'export function formatMeal() { return `${mealType} meal`; }',
        ),
        errors: ['rendered'],
      },
    ],
  },
  'tsx',
);
