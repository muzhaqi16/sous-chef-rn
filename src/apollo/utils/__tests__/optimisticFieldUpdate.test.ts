import { InMemoryCache, gql } from '@apollo/client';
import { optimisticFieldUpdate } from '../optimisticFieldUpdate';

const PROFILE_FRAGMENT = gql`
  fragment _testProfile on UserProfile {
    id
    firstName
    bio
  }
`;

const seed = () => {
  const cache = new InMemoryCache();
  cache.writeFragment({
    id: 'UserProfile:p1',
    fragment: PROFILE_FRAGMENT,
    data: { __typename: 'UserProfile', id: 'p1', firstName: 'Jo', bio: 'old' },
  });
  return cache;
};

const readProfile = (cache: InMemoryCache) =>
  cache.readFragment<{ firstName: string; bio: string | null }>({
    id: 'UserProfile:p1',
    fragment: PROFILE_FRAGMENT,
  });

describe('optimisticFieldUpdate', () => {
  it('writes the input fields optimistically and leaves others untouched', () => {
    const cache = seed();
    optimisticFieldUpdate(
      cache,
      'UserProfile:p1',
      readProfile(cache),
      { firstName: 'Jane' },
      'Update Profile',
    );
    expect(readProfile(cache)).toMatchObject({ firstName: 'Jane', bio: 'old' });
  });

  it('restores the snapshot on revert', () => {
    const cache = seed();
    const { revert } = optimisticFieldUpdate(
      cache,
      'UserProfile:p1',
      readProfile(cache),
      { firstName: 'Jane', bio: 'new' },
      'Update Profile',
    );
    expect(readProfile(cache)).toMatchObject({ firstName: 'Jane', bio: 'new' });
    revert();
    expect(readProfile(cache)).toMatchObject({ firstName: 'Jo', bio: 'old' });
  });

  it('is a no-op (revert safe) when the entity is not cached', () => {
    const cache = seed();
    const { revert } = optimisticFieldUpdate(
      cache,
      undefined,
      null,
      { firstName: 'Jane' },
      'Update Profile',
    );
    expect(() => revert()).not.toThrow();
    // Unchanged.
    expect(readProfile(cache)).toMatchObject({ firstName: 'Jo' });
  });
});
