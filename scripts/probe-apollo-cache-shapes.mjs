/**
 * Prints two shapes the INSTALLED Apollo Client produces that this codebase
 * branches on, neither of which is visible to the type system.
 *
 *   node scripts/probe-apollo-cache-shapes.mjs
 *
 * Both were assumed rather than checked, and both assumptions were wrong in a
 * way that produces no error — the guard runs, returns a value of the right
 * type, and is silently wrong for every input. This re-derives them in one
 * command against whatever is in node_modules, so the rules that depend on them
 * stay falsifiable.
 *
 * 1. `storeFieldName` serialization. A `cache.modify` modifier receives the
 *    field's store key. `skipUnmatchedArgVariants` parsed it by looking for a
 *    `(` — which is only one of the two forms Apollo emits.
 *
 * 2. Partial-read key presence. `returnPartialData` OMITS a field the cache
 *    cannot satisfy; it does not set it to `undefined`. A completeness test
 *    written as `value !== undefined` therefore passes for every partially
 *    cached object.
 *
 * Result on @apollo/client 4.x (2026-08) — see the printed output for the
 * version actually installed:
 *
 *   keyArgs: ['homeId']        -> storageLocations:{"homeId":"A"}   (colon form)
 *   keyArgs: false / arguments -> things({"filters":{...}})          (paren form)
 *   partial read of a missing leaf -> key ABSENT ('k' in obj === false)
 */
import { InMemoryCache, gql } from '@apollo/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const apolloVersion = require('@apollo/client/package.json').version;

console.log(`@apollo/client ${apolloVersion}\n`);

// 1. storeFieldName serialization

const observed = [];

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // An ARRAY keyArgs — the shape `storageLocations(homeId:)` uses.
        storageLocations: { keyArgs: ['homeId'] },
        // No keyArgs: Apollo keys on the whole argument set instead.
        things: {},
      },
    },
  },
});

const LOCATIONS = gql`
  query L($homeId: String!) {
    storageLocations(homeId: $homeId) {
      __typename
      id
    }
  }
`;

const THINGS = gql`
  query T($filters: Filters) {
    things(filters: $filters) {
      __typename
      id
    }
  }
`;

for (const homeId of ['A', 'B']) {
  cache.writeQuery({
    query: LOCATIONS,
    variables: { homeId },
    data: {
      storageLocations: [
        { __typename: 'StorageLocation', id: `loc-${homeId}` },
      ],
    },
  });
}

cache.writeQuery({
  query: THINGS,
  variables: { filters: { category: 'x' } },
  data: { things: [{ __typename: 'Thing', id: 't1' }] },
});

cache.modify({
  fields: {
    storageLocations(existing, { storeFieldName }) {
      observed.push(storeFieldName);
      return existing;
    },
    things(existing, { storeFieldName }) {
      observed.push(storeFieldName);
      return existing;
    },
  },
});

console.log('storeFieldName forms a modifier receives:');
for (const name of observed) {
  const paren = name.indexOf('(');
  const colon = name.indexOf(':');
  console.log(
    `  ${name}\n` +
      `      indexOf('(') = ${paren}   indexOf(':') = ${colon}   ` +
      `form = ${paren === -1 ? 'COLON' : 'PAREN'}`,
  );
}

const anyColonOnly = observed.some(
  n => n.indexOf('(') === -1 && n.includes(':'),
);
console.log(
  `\n  => a guard that requires '(' misses ${
    anyColonOnly ? 'the colon form' : 'nothing'
  }.\n`,
);

// Does Apollo export a parser covering both? (Settles the open question in
// the change's design.md.)
let parserExport = 'none found';
try {
  const utilities = await import('@apollo/client/utilities');
  const candidates = [
    'fieldNameFromStoreName',
    'argumentsObjectFromField',
    'storeKeyNameFromField',
  ].filter(name => typeof utilities[name] === 'function');
  if (candidates.length) {
    parserExport = candidates.join(', ');
    if (typeof utilities.fieldNameFromStoreName === 'function') {
      const samples = observed.map(
        n => `${n} -> field "${utilities.fieldNameFromStoreName(n)}"`,
      );
      console.log('fieldNameFromStoreName:');
      for (const s of samples) console.log(`  ${s}`);
      console.log(
        '  => strips the args but does NOT return them, so the ARGS still\n' +
          '     have to be parsed by hand. Both forms must be handled.\n',
      );
    }
  }
} catch {
  parserExport = 'module not importable';
}
console.log(`Apollo arg-parsing exports available: ${parserExport}\n`);

// 2. Partial reads omit keys, they do not undefine them

const partialCache = new InMemoryCache();

// Seed with a NARROWER selection than the one read back: no `isPrimary`.
partialCache.writeFragment({
  id: 'Item:x',
  fragment: gql`
    fragment Narrow on Item {
      __typename
      id
      categories {
        __typename
        category {
          __typename
          id
          name
        }
      }
    }
  `,
  data: {
    __typename: 'Item',
    id: 'x',
    categories: [
      {
        __typename: 'ItemCategoryLink',
        category: { __typename: 'ItemCategory', id: 'c1', name: 'Dairy' },
      },
    ],
  },
});

const WIDE = gql`
  fragment Wide on Item {
    __typename
    id
    categories {
      __typename
      isPrimary
      category {
        __typename
        id
        name
      }
    }
  }
`;

const strict = partialCache.readFragment({ id: 'Item:x', fragment: WIDE });
const partial = partialCache.readFragment({
  id: 'Item:x',
  fragment: WIDE,
  returnPartialData: true,
});

const link = partial?.categories?.[0] ?? {};
console.log('Partial read of an entity cached by a narrower selection:');
console.log(
  `  strict readFragment          -> ${
    strict === null ? 'null (incomplete)' : 'object'
  }`,
);
console.log(
  `  partial read keys on the link -> ${JSON.stringify(Object.keys(link))}`,
);
console.log(`  'isPrimary' in link           -> ${'isPrimary' in link}`);
console.log(
  `  link.isPrimary === undefined  -> ${link.isPrimary === undefined}`,
);
console.log(
  `\n  => the key is ABSENT, not undefined. A completeness test written as\n` +
    `     \`value !== undefined\` sees nothing wrong with this object, so writing\n` +
    `     it back re-states the incompleteness instead of repairing it.\n`,
);

const keyAbsent = !('isPrimary' in link);
if (!keyAbsent || !anyColonOnly) {
  console.error(
    '✗ Apollo no longer behaves as the rules built on this probe assume.\n' +
      '  Re-read scripts/lib and the guards in cacheUpdaters.ts / ' +
      'writePantryItemDetailStub.ts before trusting either.',
  );
  process.exit(1);
}

console.log('✓ Both shapes are as the guards built on this probe assume.');
