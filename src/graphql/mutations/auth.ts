import {gql} from '@apollo/client';

// Minimal user data for authentication flows
export const AUTH_USER_FRAGMENT = gql`
  fragment AuthUser on User {
    id
    email
    emailVerified
    role
    onBoarded
    createdAt
    updatedAt
    timezone
  }
`;

// Complete user data for profile/settings screens
export const COMPLETE_USER_FRAGMENT = gql`
  fragment CompleteUser on User {
    id
    email
    emailVerified
    role
    onBoarded
    createdAt
    updatedAt
    timezone
    addresses {
      id
      label
      street
      city
      state
      postalCode
      country
      lat
      lng
      isDefault
    }
    devices {
      id
      userId
      deviceId
      deviceName
      deviceType
      userAgent
      browserName
      browserVersion
      osName
      osVersion
      screenResolution
      timezone
      language
      appVersion
      platform
      pushToken
      isActive
      isTrusted
      lastSeenAt
      lastIpAddress
      lastCountry
      lastCity
      isVerified
      verifiedAt
      loginCount
      lastLoginAt
      createdAt
      updatedAt
      deletedAt
    }
    homeOwnerships {
      id
      home {
        id
        name
        createdAt
      }
    }
    purchases {
      id
    }
    shoppingListOwnerships {
      createdAt
      id
      shoppingListId
      transferredAt
      transferredFrom
    }
  }
`;

// Authentication mutations with minimal user data
export const LOGIN_MUTATION = gql`
  ${AUTH_USER_FRAGMENT}
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
        ...AuthUser
      }
    }
  }
`;

export const SIGNUP_MUTATION = gql`
  ${AUTH_USER_FRAGMENT}
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        ...AuthUser
      }
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($token: String!) {
    refresh(token: $token) {
      accessToken
      refreshToken
    }
  }
`;

export const VERIFY_EMAIL_MUTATION = gql`
  ${AUTH_USER_FRAGMENT}
  mutation VerifyEmail($code: String!) {
    verifyEmail(code: $code)
  }
`;

export const FORGOT_PASSWORD_MUTATION = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input)
  }
`;

export const RESEND_VERIFICATION_EMAIL_MUTATION = gql`
  mutation ResendVerificationEmail($email: String!) {
    resendVerificationEmail(email: $email)
  }
`;

// Separate query for when you need complete user data
export const GET_CURRENT_USER = gql`
  ${COMPLETE_USER_FRAGMENT}
  query GetCurrentUser {
    me {
      ...AuthUser
    }
  }
`;

// Query for user profile page
export const GET_USER_PROFILE = gql`
  ${COMPLETE_USER_FRAGMENT}
  query GetUserProfile {
    me {
      ...CompleteUser
    }
  }
`;
