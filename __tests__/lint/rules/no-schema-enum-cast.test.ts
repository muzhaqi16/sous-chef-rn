import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-schema-enum-cast', {
  valid: [
    'const a = value as { id?: string };',
    'const f = value as Profile;',
    'const g = value as string | null;',
    'const h = value as Array<RecipeRow>;',
    'const i = value as Cuisine | RecipeRow;',
    'const j = value as Partial<Cuisine>;',
    'const e = [] as readonly string[];',
    'const k = { visibility: ProfileVisibility.Public } as const;',
    'const l = (v: string): v is Diet => new Set<string>(Object.values(Diet)).has(v);',
    // The general cast bans moved to `no-restricted-syntax`; this rule is the
    // enum check alone, so the others are valid here.
    'const a = value as any;',
    'const a = value as unknown as T;',
    'const a = value as Record<string, unknown>;',
  ],
  invalid: [
    { code: 'save(v as ProfileVisibility);', errors: ['asSchemaEnum'] },
    {
      code: 'const p = value as RecurringPattern | null;',
      errors: ['asSchemaEnum'],
    },
    { code: 'const c = values as Cuisine[];', errors: ['asSchemaEnum'] },
    { code: 'const d = values as Array<Diet>;', errors: ['asSchemaEnum'] },
    {
      code: 'const d = values as ReadonlyArray<Diet | Cuisine>;',
      errors: ['asSchemaEnum'],
    },
    {
      code: 'const d = values as readonly (Diet | null)[];',
      errors: ['asSchemaEnum'],
    },
    {
      code: 'const u = unit as UnitType | undefined;',
      errors: ['asSchemaEnum'],
    },
    { code: 'const u = unit as Types.UnitType;', errors: ['asSchemaEnum'] },
    {
      code: 'const c = rows.map(r => r.cuisine).filter(Boolean) as Cuisine[];',
      errors: ['asSchemaEnum'],
    },
  ],
});
