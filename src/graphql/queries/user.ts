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
