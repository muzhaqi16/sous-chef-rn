import { testTypedRule } from '#/test-utils/eslintRuleTester';

const PRELUDE = `declare const t: (key: string, options?: unknown, more?: unknown) => string;
declare const tGlobal: typeof t;
declare const i18n: { t: typeof t };
declare const serverMessage: string;
declare const options: { count: number };
`;

const code = (body: string) => `${PRELUDE}${body}\n`;

testTypedRule('no-t-default-value', {
  valid: [
    code("export const a = t('errors.generic');"),
    code("export const a = t('labels.items', { count: 2 });"),
    code("export const a = tGlobal('labels.items', options);"),
    // Not a translate call.
    code("export const a = [1].join(', ');"),
  ],
  invalid: [
    {
      code: code(
        "export const a = t('errors.generic', 'Something went wrong');",
      ),
      errors: ['stringFallback'],
    },
    {
      code: code("export const a = tGlobal('errors.generic', serverMessage);"),
      errors: ['stringFallback'],
    },
    {
      code: code(
        "export const a = i18n.t('errors.rate', { count: 2, defaultValue: 'Too many' });",
      ),
      errors: ['defaultValue'],
    },
    {
      code: code(
        "export const a = t('errors.rate', `Try again`, { defaultValue: 'x' });",
      ),
      errors: ['stringFallback', 'defaultValue'],
    },
  ],
});
