import { makeCache } from '#/apollo/cache';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import { createApolloTestWrapper } from '#/test-utils/apolloMockProvider';

const cache = makeCache();
let held = '';

describe('a write a test leaves pending', () => {
  it('holds through its own test', () => {
    createApolloTestWrapper({ cache, operationMocks: [] });

    held = pendingWritesOf(cache).begin(UpdateHomeDocument, {
      input: { id: 'home-1' },
    }).id;

    expect(pendingWritesOf(cache).get(held)).toBeDefined();
  });

  it('goes with that test, so its rebuild cannot run inside the next', () => {
    expect(held).not.toBe('');
    expect(pendingWritesOf(cache).get(held)).toBeUndefined();
  });
});
