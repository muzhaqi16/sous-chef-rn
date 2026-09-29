'use no memo';

import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import {
  GetUserProfileDocument,
  UpdateUserProfileDocument,
} from '#operations/auth/user.generated';
import { ErrorCode, ProfileVisibility } from '#/graphql/generated/schemaTypes';
import { adoptCreatedProfile } from '#features/profile/cache/adoptCreatedProfile';
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

const PLACEHOLDER = 'UserProfile:user-1:profile';

const readProfile = (cache: ReturnType<typeof makeCache>) =>
  cache.readQuery({ query: GetUserProfileDocument })?.me?.profile;

// What `queueLink` resolves a queued write with: the payload field null.
const queuedWrite = () =>
  recordMock(UpdateUserProfileDocument, {
    data: { updateProfile: null },
    partial: true,
  });

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

      const profile = readProfile(cache);
      expect(profile?.id).toBe('profile-new');
      expect(profile?.firstName).toBe('Ada');
      expect(cache.extract()[PLACEHOLDER]).toBeUndefined();
    });

    // Offline there is no created row yet; without a local one the field kept
    // its empty value and the save looked lost until the queue replayed.
    it('shows a queued first save at once, on a local row', async () => {
      const cache = cacheWithoutProfile();
      const { result } = renderHookWithApollo(() => useUpdateProfile(null), {
        operationMocks: [queuedWrite().mock],
        cache,
      });

      await act(() => result.current.updateProfile({ firstName: 'Ada' }));

      expect(readProfile(cache)).toMatchObject({
        firstName: 'Ada',
        lastName: null,
        profileVisibility: ProfileVisibility.Private,
        showEmail: false,
      });
    });

    it('moves me onto the created row when the queued save replays', async () => {
      const cache = cacheWithoutProfile();
      const { result } = renderHookWithApollo(() => useUpdateProfile(null), {
        operationMocks: [queuedWrite().mock],
        cache,
      });
      await act(() => result.current.updateProfile({ firstName: 'Ada' }));

      // The replay normalizes the created row; its reconciler then links it.
      const created = { ...readProfile(cache), id: 'profile-new' };
      cache.writeFragment({
        id: 'UserProfile:profile-new',
        fragment: gql`
          fragment TestCreatedProfile on UserProfile {
            id
            firstName
            lastName
            displayName
            bio
            avatar
            phone
            dateOfBirth
            gender
            profileVisibility
            showEmail
            showPhone
          }
        `,
        data: created,
      });
      adoptCreatedProfile(cache, {
        updateProfile: {
          __typename: 'UpdateProfilePayload',
          userProfile: { __typename: 'UserProfile', id: 'profile-new' },
        },
      });

      expect(readProfile(cache)?.id).toBe('profile-new');
      expect(cache.extract()[PLACEHOLDER]).toBeUndefined();
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

      expect(readProfile(cache)).toBeNull();
      expect(cache.extract()[PLACEHOLDER]).toBeUndefined();
    });
  });
});
