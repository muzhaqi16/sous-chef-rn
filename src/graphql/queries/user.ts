import {gql} from '@apollo/client';

export const GET_ME = gql`
  query Me {
    me {
      id
      email
      emailVerified
      role
      onBoarded
      timezone
      preferredCurrency
      language
      defaultShoppingListId
      defaultHomeId
      createdAt
      updatedAt
      lastActiveAt
      profile {
        id
        firstName
        lastName
        displayName
        bio
        avatar
        phone
      }
      settings {
        id
        emailNotifications
        pushNotifications
        theme
      }
    }
  }
`;

export const GET_USER_SETTINGS = gql`
  query UserSettings {
    userSettings {
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
