import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { relative } from 'path';

/**
 * Two operations selecting one merged connection share a cache field.
 * `mergeAuthoritativeFirstPage` reads a missing `hasNextPage` as "covers the
 * whole list", so a consumer selecting no `pageInfo` strips it — and the other
 * consumer's read goes permanently incomplete.
 */
const OPERATION_FILES = globSync('src/**/*.graphql').map(f =>
  relative(process.cwd(), f),
);

/**
 * Connection fields carrying a merge policy. Globbed rather than read from one
 * file: the policies live with their features, so a hard-coded path would stop
 * seeing the policy a change actually lands in.
 */
const POLICY_FILES = globSync('src/features/*/cache/typePolicies.ts');

const mergedConnectionFields = (): string[] => {
  const declarations = POLICY_FILES.map(f => readFileSync(f, 'utf8')).join('\n');
  return [
    ...new Set(
      [
        ...declarations.matchAll(
          /^\s*(\w+):\s*(?:\.\.\.)?mergeConnectionByNodeId\(/gm,
        ),
      ]
        .map(m => m[1])
        .filter(name => name !== 'homes'),
    ),
  ];
};

const MERGED_FIELDS = mergedConnectionFields();

/** Each selection's body, brace-matched so an inner `edges { … }` is included. */
const selectionsOf = (source: string, field: string): string[] => {
  const found: string[] = [];
  const opener = new RegExp(`\\b${field}\\s*(\\([^)]*\\))?\\s*\\{`, 'g');

  while (opener.exec(source)) {
    let depth = 1;
    let i = opener.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    found.push(source.slice(opener.lastIndex, i - 1));
  }
  return found;
};

/**
 * Pre-existing selections writing edges without `pageInfo`. Real instances of
 * the same hazard, latent only because no paginating consumer shares them.
 */
const NO_PAGE_INFO_NEEDED: Record<string, string> = {
  'src/features/home/components/HomeCard.graphql#membersConnection':
    'pre-existing; fixed-size card preview, no paginating consumer',
  'src/features/home/components/HomeCard.graphql#invitesConnection':
    'pre-existing; fixed-size card preview, no paginating consumer',
  'src/features/home/screens/HomeDetailScreen.graphql#membersConnection':
    'pre-existing; whole-list read, no paginating consumer',
  'src/features/home/screens/HomeDetailScreen.graphql#invitesConnection':
    'pre-existing; whole-list read, no paginating consumer',
  'src/features/home/screens/HomeDetailScreen.graphql#pantriesConnection':
    'pre-existing; whole-list read, no paginating consumer',
  'src/features/pantry/components/form/PantryItemForm.graphql#pantriesConnection':
    'pre-existing; picker options, no paginating consumer',
  'src/graphql/operations/auth/userFragments.graphql#pantriesConnection':
    'pre-existing; session bootstrap, no paginating consumer',
  'src/graphql/operations/home/home.graphql#membersConnection':
    'pre-existing; whole-list read, no paginating consumer',
  'src/graphql/operations/home/home.graphql#pantriesConnection':
    'pre-existing; whole-list read, no paginating consumer',
};

const offenders = OPERATION_FILES.flatMap(file => {
  const source = readFileSync(file, 'utf8');

  return MERGED_FIELDS.flatMap(field =>
    selectionsOf(source, field)
      // Only a selection carrying `edges` writes a PAGE. A count-only read
      // writes no edges, and the merge preserves the cached list against it.
      .filter(body => /\bedges\b/.test(body) && !/\bpageInfo\b/.test(body))
      .map(() => `${file}#${field}`),
  );
});

describe('operations sharing a merged connection field', () => {
  it('finds the merge policies and the documents to check', () => {
    // Either scan returning nothing would pass this file vacuously.
    expect(POLICY_FILES.length).toBeGreaterThan(3);
    expect(MERGED_FIELDS.length).toBeGreaterThan(5);
    expect(OPERATION_FILES.length).toBeGreaterThan(10);
  });

  it('locates a selection body it can read', () => {
    const sample = selectionsOf(
      readFileSync('src/features/pantry/graphql/pantry.graphql', 'utf8'),
      'pantryItemBatchesConnection',
    );

    expect(sample.length).toBeGreaterThan(0);
    expect(sample.some(body => /\bedges\b/.test(body))).toBe(true);
  });

  it('selects pageInfo everywhere, so no consumer strips it', () => {
    const unexplained = offenders.filter(o => !(o in NO_PAGE_INFO_NEEDED));

    expect(unexplained).toEqual([]);
  });

  it('keeps the pre-existing list honest', () => {
    const stale = Object.keys(NO_PAGE_INFO_NEEDED).filter(
      k => !offenders.includes(k),
    );

    expect(stale).toEqual([]);
  });
});
