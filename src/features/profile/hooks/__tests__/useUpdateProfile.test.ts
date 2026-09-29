'use no memo';

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import {
  GetUserProfileDocument,
  UpdateUserProfileDocument,
} from '#operations/auth/user.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useUpdateProfile } from '../useUpdateProfile';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const createdProfile = (firstName: string) =>
  recordMock(UpdateUserProfileDocument, {
    data: {
      updateProfile: {
        __typename: 'UpdateProfilePayload',
        userProfile: {
          __typename: 'UserProfile',
          id: 'profile-new',
          firstName,
        },
      },
    },
  });

// `me` answered with no profile: the account has none yet.
const cacheWithoutProfile = () => {
  const cache = makeCache();
  cache.writeQuery({
    query: GetUserProfileDocument,
    data: {
      __typename: 'Query',
      me: { __typename: 'User', id: 'user-1', profile: null },
    },
  });
  return cache;
};

describe('useUpdateProfile', () => {
  describe('for an account with no profile yet', () => {
    it('sends the write, since updateProfile upserts the row', async () => {
      const { mock, fired } = createdProfile('Ada');
      const { result } = renderHookWithApollo(() => useUpdateProfile(null), {
        operationMocks: [mock],
        cache: cacheWithoutProfile(),
      });

      await act(() => result.current.updateProfile({ firstName: 'Ada' }));

      expect(fired).toEqual([{ input: { firstName: 'Ada' } }]);
    });

    // Without the link `me.profile` stays null, and the screen keeps showing
    // an empty form over the profile it just created.
    it('links the created profile to me', async () => {
      const cache = cacheWithoutProfile();
      const { mock } = createdProfile('Ada');
      const { result } = renderHookWithApollo(() => useUpdateProfile(null), {
        operationMocks: [mock],
        cache,
      });

      await act(() => result.current.updateProfile({ firstName: 'Ada' }));

      const profile = cache.readQuery({ query: GetUserProfileDocument })?.me
        ?.profile;
      expect(profile?.id).toBe('profile-new');
      expect(profile?.firstName).toBe('Ada');
    });

    it('links nothing when the server refuses the write', async () => {
      const cache = cacheWithoutProfile();
      const { mock } = recordMock(UpdateUserProfileDocument, {
        data: {
          updateProfile: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'Invalid name',
            field: 'firstName',
          },
        },
      });
      const { result } = renderHookWithApollo(() => useUpdateProfile(null), {
        operationMocks: [mock],
        cache,
      });

      await act(() => result.current.updateProfile({ firstName: '' }));

      expect(
        cache.readQuery({ query: GetUserProfileDocument })?.me?.profile,
      ).toBeNull();
    });
  });
});
