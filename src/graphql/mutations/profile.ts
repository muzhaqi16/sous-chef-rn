import {gql} from '@apollo/client';

export const UPDATE_USER_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateUserProfileInput!) {
    updateProfile(input: $input) {
      id
      userId
      firstName
      lastName
      displayName
      bio
      avatar
      coverImage
      phone
      website
      dateOfBirth
      gender
      profileVisibility
      showEmail
      showPhone
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_USER_PREFERENCES_MUTATION = gql`
  mutation UpdateSettings($input: UpdateUserSettingsInput!) {
    updateSettings(input: $input) {
      id
      userId
      emailNotifications
      pushNotifications
      smsNotifications
      weeklyDigest
      expiredItemAlerts
      lowStockAlerts
      shoppingListUpdates
      recipeRecommendations
      theme
      compactMode
      showTutorials
      autoSync
      offlineMode
      shareUsageData
      shareWithPartners
      personalizedAds
      enabledFeatures
      betaFeatures
      createdAt
      updatedAt
    }
  }
`;
