/**
 * What a replay reads from the cache must also be captured when the write is
 * queued, or a unit that leaves the cache makes the replay name an id the
 * vocabulary repair may have retired.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { makeQueuedMutation } from '#/test-utils/queuedMutation';
import { REPLAY_PREPARATIONS } from '#/apollo/offlineQueue/preparationRegistry';
import { captureReplayInputs } from '#/apollo/offlineQueue/prepareReplay';

describe('replay reads are captured when queued', () => {
  it.each(Object.keys(REPLAY_PREPARATIONS))(
    '%s captures the unit symbols its replay reads',
    operationName => {
      const cache = makeCache();
      cache.writeFragment({
        fragment: gql`
          fragment CapturedUnit on Unit {
            id
            symbol
          }
        `,
        data: { __typename: 'Unit', id: 'unit-1', symbol: 'tbsp' },
      });
      const mutation = makeQueuedMutation({
        operationName,
        variables: {
          input: {
            unit: { id: 'unit-1' },
            unitId: 'unit-1',
            items: [{ unit: { id: 'unit-1' } }],
          },
        },
      });

      expect(captureReplayInputs(mutation, cache)).toEqual({
        'unit:unit-1': 'tbsp',
      });
    },
  );
});
