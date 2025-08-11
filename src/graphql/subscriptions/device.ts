import {gql} from '@apollo/client';

export const DEVICE_ACTIVITY_SUBSCRIPTION = gql`
  subscription DeviceActivity($userId: ID!) {
    deviceActivity(userId: $userId) {
      id
      userId
      deviceId
      deviceName
      deviceType
      platform
      lastSeenAt
      lastIpAddress
      lastCountry
      lastCity
      isActive
      isTrusted
      loginCount
      user {
        id
        email
      }
    }
  }
`;

export const DEVICE_REGISTERED_SUBSCRIPTION = gql`
  subscription DeviceRegistered($userId: ID!) {
    deviceRegistered(userId: $userId) {
      id
      userId
      deviceId
      deviceName
      deviceType
      platform
      userAgent
      browserName
      browserVersion
      osName
      osVersion
      isActive
      isTrusted
      isVerified
      createdAt
    }
  }
`;

export const DEVICE_STATUS_CHANGED_SUBSCRIPTION = gql`
  subscription DeviceStatusChanged($userId: ID!) {
    deviceStatusChanged(userId: $userId) {
      id
      userId
      deviceId
      deviceName
      isActive
      lastSeenAt
      updatedAt
    }
  }
`;

export const DEVICE_TRUST_CHANGED_SUBSCRIPTION = gql`
  subscription DeviceTrustChanged($userId: ID!) {
    deviceTrustChanged(userId: $userId) {
      id
      userId
      deviceId
      deviceName
      isTrusted
      updatedAt
    }
  }
`;

export const DEVICE_VERIFIED_SUBSCRIPTION = gql`
  subscription DeviceVerified($userId: ID!) {
    deviceVerified(userId: $userId) {
      id
      userId
      deviceId
      deviceName
      isVerified
      verifiedAt
    }
  }
`;
