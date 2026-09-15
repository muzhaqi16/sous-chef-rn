import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-unsafe-cast', {
  valid: [
    'const a = value as { id?: string };',
    'const b: Record<string, number> = {};',
    'type K = keyof typeof table;',
    'const c = table[key as K];',
    'const d = value as T[keyof T];',
    'const e = [] as readonly string[];',
    'if (isOwnKey(table, key)) use(table[key]);',
  ],
  invalid: [
    { code: 'const a = value as any;', errors: ['asAny'] },
    { code: 'const a = value as any[];', errors: ['asAnyArray'] },
    { code: 'const a = value as unknown as T;', errors: ['asUnknown'] },
    {
      code: 'extractNodes(home.pantriesConnection as never);',
      errors: ['asNever'],
    },
    {
      code: 'const a = value as Record<string, unknown>;',
      errors: ['asRecord'],
    },
    {
      code: 'const n = counts[`rating${n}Count` as keyof typeof counts];',
      errors: ['asKeyof'],
    },
    {
      code: 'setValue(field as keyof FormValues, value);',
      errors: ['asKeyof'],
    },
    {
      code: 'const keys = Object.keys(defaults) as (keyof FormData)[];',
      errors: ['asKeyof'],
    },
    {
      code: 'const keys = Object.keys(defaults) as readonly (keyof FormData)[];',
      errors: ['asKeyof'],
    },
    {
      code: 'const keys = Object.keys(defaults) as Array<keyof FormData>;',
      errors: ['asKeyof'],
    },
    {
      code: 'const k = key as Extract<keyof FormData, string>;',
      errors: ['asKeyof'],
    },
    {
      code: 'const key = `errors.field.${field}` as TranslationKey;',
      errors: ['asTranslationKey'],
    },
  ],
});
