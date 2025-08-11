import {gql} from '@apollo/client';

export const USER_UPDATED_SUBSCRIPTION = gql`
  subscription UserUpdated($userId: ID) {
    userUpdated(userId: $userId) {
      mutation
      node {
        id
        email
        emailVerified
        role
        onBoarded
        timezone
        preferredCurrency
        language
        lastActiveAt
        profile {
          id
          firstName
          lastName
          displayName
          avatar
          bio
        }
      }
      previousValues {
        email
        role
        timezone
        preferredCurrency
        language
      }
      updatedFields
      userId
      timestamp
    }
  }
`;

export const USER_STATUS_CHANGED_SUBSCRIPTION = gql`
  subscription UserStatusChanged($userId: ID) {
    userStatusChanged(userId: $userId) {
      userId
      newStatus
      previousStatus
      isOnline
      lastActiveAt
      timestamp
    }
  }
`;

export const USER_ACTIVITY_SUBSCRIPTION = gql`
  subscription UserActivity($userId: ID) {
    userActivity(userId: $userId) {
      userId
      activityType
      description
      metadata
      timestamp
    }
  }
`;

export const USER_MODERATION_CHANGED_SUBSCRIPTION = gql`
  subscription UserModerationChanged($userId: ID) {
    userModerationChanged(userId: $userId) {
      userId
      moderationType
      moderationStatus
      reason
      moderatedBy
      timestamp
    }
  }
`;

export const USER_PROFILE_CHANGED_SUBSCRIPTION = gql`
  subscription UserProfileChanged($userId: ID) {
    userProfileChanged(userId: $userId) {
      userId
      mutation
      profile {
        id
        firstName
        lastName
        displayName
        bio
        avatar
        coverImage
        phone
        website
        profileVisibility
      }
      previousValues {
        firstName
        lastName
        displayName
        bio
        avatar
      }
      updatedFields
      timestamp
    }
  }
`;

export const USER_AUTH_SUBSCRIPTION = gql`
  subscription UserAuth($userId: ID) {
    userAuth(userId: $userId) {
      userId
      authType
      deviceInfo
      timestamp
    }
  }
`;

export const USER_SOCIAL_SUBSCRIPTION = gql`
  subscription UserSocial($userId: ID) {
    userSocial(userId: $userId) {
      userId
      targetUserId
      action
      timestamp
    }
  }
`;
