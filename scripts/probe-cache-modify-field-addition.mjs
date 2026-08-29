/**
 * Probe: can `cache.modify` write a field the store object does not already
 * hold?
 *
 * `writeEntityFields` is the single write behind every local-first field update
 * (settings, storage locations, meal-template rows). It used to run through
 * `cache.modify`, whose docs describe modifiers as "fields of the object" —
 * leaving it open whether naming an absent field ADDS it or is ignored.
 *
 * It matters because which fields a cached entity carries is decided by
 * whichever query loaded it, not by the schema. `GetMealTemplateForEdit` selects
 * no `recipe`, so a row it loaded has no such field, and a local-first write of
 * one either lands or vanishes with no error either way.
 *
 * Runs the real InMemoryCache.
 */
import { InMemoryCache, gql } from '@apollo/client';

const cache = new InMemoryCache();
cache.writeFragment({
  id: 'X:1',
  fragment: gql`
    fragment Seed on X {
      id
      present
    }
  `,
  data: { __typename: 'X', id: '1', present: 'before' },
});

let absentModifierRan = false;
cache.modify({
  id: 'X:1',
  fields: {
    present: () => 'after',
    absent: () => {
      absentModifierRan = true;
      return 'added';
    },
  },
});

const stored = cache.extract()['X:1'];
const version = JSON.parse(
  await import('node:fs').then(fs =>
    fs.readFileSync('node_modules/@apollo/client/package.json', 'utf8'),
  ),
).version;

console.log(`@apollo/client@${version}`);
console.log(
  '  modifier ran for the PRESENT field:',
  stored.present === 'after',
);
console.log('  modifier ran for the ABSENT field: ', absentModifierRan);
console.log('  absent field in the store after:   ', 'absent' in stored);
console.log();

if (absentModifierRan || 'absent' in stored) {
  console.log(
    'CHANGED: cache.modify now adds absent fields. writeEntityFields could go\n' +
      'back to it — see docs/verified-library-behaviour.md#cache-modify-cannot-add-a-field',
  );
  process.exit(1);
}
console.log(
  'CONFIRMED: cache.modify cannot introduce a field. writeEntityFields must\n' +
    'keep using writeFragment.',
);
