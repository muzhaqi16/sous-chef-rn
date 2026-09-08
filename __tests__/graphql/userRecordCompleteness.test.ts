/**
 * Cache invariant: every selection set that writes a `User` record writes the
 * fields the app's `User` readers select off it.
 *
 * `returnPartialData` is false, so ONE missing field makes the whole read
 * return nothing — not a partial object. A members list cached by `GetHomes`
 * with `user { id email }` therefore blanks `HomeMemberCard`, which reads
 * `user { id email displayName }` off the same normalized record.
 *
 * Both sides are derived from the document tree, resolved against the real
 * schema, so adding a field to a reader fails here until every writer carries
 * it and a new writer cannot ship short.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  parse,
  visit,
  visitWithTypeInfo,
  TypeInfo,
  getNamedType,
  Kind,
  type SelectionSetNode,
} from 'graphql';

const SRC = path.resolve(__dirname, '../../src');
const schema = buildSchema(
  fs.readFileSync(path.join(SRC, 'graphql/generated/schema.graphql'), 'utf8'),
);

const graphqlFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return graphqlFiles(full);
    return entry.name.endsWith('.graphql') && !full.includes('generated')
      ? [full]
      : [];
  });

const scalarNames = (selectionSet: SelectionSetNode): string[] =>
  selectionSet.selections
    .filter(s => s.kind === Kind.FIELD && !s.selectionSet)
    .map(s => (s as { name: { value: string } }).name.value);

interface UserSelection {
  file: string;
  field: string;
  fields: string[];
}

const collectUserSelections = (): UserSelection[] => {
  const found: UserSelection[] = [];
  for (const file of graphqlFiles(SRC)) {
    const document = parse(fs.readFileSync(file, 'utf8'));
    const typeInfo = new TypeInfo(schema);
    visit(
      document,
      visitWithTypeInfo(typeInfo, {
        Field(node) {
          if (!node.selectionSet) return;
          const type = typeInfo.getType();
          if (!type || getNamedType(type).name !== 'User') return;
          found.push({
            file: path.relative(SRC, file),
            field: node.name.value,
            fields: scalarNames(node.selectionSet),
          });
        },
      }),
    );
  }
  return found;
};

/**
 * A selection that names a PERSON — one carrying `email`. Those are the writers
 * a member or collaborator cell reads back through. A selection of `id` alone
 * is a reference for a cache update, and one that reads a counter off `me`
 * claims nothing about who the account belongs to; neither stands in for a
 * person on screen, and widening them would add a field nothing there displays.
 */
const namesAPerson = (selection: UserSelection) =>
  selection.fields.includes('email');

describe('every writer of a User record writes what the readers read', () => {
  const selections = collectUserSelections();
  const records = selections.filter(namesAPerson);

  it('resolves User selections out of the tree', () => {
    expect(records.length).toBeGreaterThan(10);
  });

  // `displayName` is how a housemate and a collaborator are named on screen. It
  // is gated by the sharing relationship rather than by profile visibility, so
  // it is readable where `profile` is not, and the cells read it directly off
  // the User record rather than through the profile.
  it.each(['id', 'displayName'])('every User record carries %s', fieldName => {
    const short = records.filter(s => !s.fields.includes(fieldName));

    expect(
      short.map(s => `${s.file} → ${s.field} { ${s.fields.join(' ')} }`),
    ).toEqual([]);
  });
});
