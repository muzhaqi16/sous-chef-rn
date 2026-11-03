/**
 * The installed Apollo runs a `cache.modify` modifier only for a field the
 * store object already holds: one named for an absent field never runs, and
 * nothing is written, with no error. Which fields a row carries is whatever
 * query loaded it decided, so `writeEntityFields` (`../localFirstFields.ts`)
 * writes through `writeFragment`, which adds them.
 *
 * Verified: #cachemodify-cannot-add-a-field
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { seedFragment } from '#/test-utils/apolloMockProvider';

describe('cache.modify on a field the store object lacks', () => {
  it('runs no modifier for it and stores nothing', () => {
    const cache = makeCache();
    seedFragment(cache, {
      id: 'ModifyProbe:1',
      fragment: gql`
        fragment ModifyProbeSeed on ModifyProbe {
          id
          present
        }
      `,
      data: { __typename: 'ModifyProbe', id: '1', present: 'before' },
    });

    let absentModifierRan = false;
    cache.modify({
      id: 'ModifyProbe:1',
      fields: {
        present: () => 'after',
        absent: () => {
          absentModifierRan = true;
          return 'added';
        },
      },
    });
    const stored = cache.extract()['ModifyProbe:1'];

    // The same call does reach a field the row holds.
    expect(stored?.present).toBe('after');
    expect(absentModifierRan).toBe(false);
    expect(stored && 'absent' in stored).toBe(false);
  });
});
