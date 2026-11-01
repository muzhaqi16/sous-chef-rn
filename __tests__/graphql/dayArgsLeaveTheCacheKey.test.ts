/**
 * The calendar date never keys a cached field, or midnight hides what the device
 * holds and a screen goes dark offline. A read of such a field confirms each day
 * once (`useDayConfirmedRead`), so an online answer still replaces the last.
 *
 * The check asks the real policies for the key of two days, so `keyArgs: false`,
 * a list and a function all count.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  getNamedType,
  parse,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { makeCache } from '#/apollo/cache';
import { OPERATION_ROOT_DIRS } from '#/test-utils/sourceRoots';

/**
 * Names what covers a date rather than a figure that ages: yesterday's answer
 * can be wrong today, and `useMealPlans` finds the plan in the list on a miss.
 */
const ANSWERS_FOR_ITS_DATE = new Set(['Query.currentMealPlan']);

const REPO_ROOT = path.join(__dirname, '..', '..');

const filesUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return full.endsWith('.graphql') && !full.endsWith('schema.graphql')
      ? [full]
      : [];
  });

const schema = buildSchema(
  fs.readFileSync(
    path.join(REPO_ROOT, 'src/graphql/generated/schema.graphql'),
    'utf8',
  ),
  { assumeValidSDL: true },
);

/** Every `Type.field` a document asks for with a `today` argument. */
const datedFields = (): string[] => {
  const found = new Set<string>();
  for (const file of OPERATION_ROOT_DIRS.flatMap(filesUnder)) {
    const typeInfo = new TypeInfo(schema);
    visit(
      parse(fs.readFileSync(file, 'utf8')),
      visitWithTypeInfo(typeInfo, {
        Field(node) {
          const parent = typeInfo.getParentType();
          if (parent && node.arguments?.some(a => a.name.value === 'today')) {
            found.add(`${getNamedType(parent).name}.${node.name.value}`);
          }
        },
      }),
    );
  }
  return [...found].sort();
};

const dayEntersTheKey = (field: string): boolean => {
  const [typename, fieldName = ''] = field.split('.');
  const { policies } = makeCache();
  const keyOn = (today: string) =>
    policies.getStoreFieldName({ typename, fieldName, args: { today } });
  return keyOn('2026-03-10') !== keyOn('2026-03-11');
};

describe('a date stays out of the cache key', () => {
  const fields = datedFields();

  it('finds the dated fields', () => {
    expect(fields).toEqual(
      expect.arrayContaining([
        'Pantry.stats',
        'Pantry.suggestions',
        'Query.recipeSuggestions',
      ]),
    );
  });

  it('keeps every other dated field through midnight', () => {
    expect(
      fields.filter(
        field => !ANSWERS_FOR_ITS_DATE.has(field) && dayEntersTheKey(field),
      ),
    ).toEqual([]);
  });
});
