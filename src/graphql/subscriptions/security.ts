import {gql} from '@apollo/client';

export const LOGIN_ATTEMPTS_SUBSCRIPTION = gql`
  subscription LoginAttempts($userId: ID!) {
    loginAttempts(userId: $userId) {
      id
      userId
      success
      method
      provider
      ipAddress
      ipCountry
      ipRegion
      ipCity
      isVpn
      isTor
      isProxy
      userAgent
      browserName
      browserVersion
      osName
      osVersion
      deviceType
      isMobileApp
      riskScore
      isRisky
      riskFactors
      failureReason
      failureDetails
      isNewLocation
      isNewDevice
      isNewBrowser
      loggedInAt
      user {
        id
        email
      }
    }
  }
`;

export const SUSPICIOUS_ACTIVITY_SUBSCRIPTION = gql`
  subscription SuspiciousActivity($userId: ID!) {
    suspiciousActivity(userId: $userId) {
      rapidAttempts {
        hour
        count
      }
      riskyLogins {
        id
        ipAddress
        ipCountry
        riskScore
        riskFactors
        loggedInAt
      }
      newLocationLogins {
        id
        ipAddress
        ipCountry
        ipCity
        loggedInAt
      }
      newDeviceLogins {
        id
        deviceType
        browserName
        osName
        loggedInAt
      }
      failedFromSameIP {
        ipAddress
        count
      }
      suspiciousActivity
      unusualTimeLogins {
        id
        loggedInAt
        timezoneDiff
      }
      multipleAccountsFromIP {
        ipAddress
        count
      }
    }
  }
`;

export const FAILED_LOGIN_ATTEMPTS_SUBSCRIPTION = gql`
  subscription FailedLoginAttempts($userId: ID!) {
    failedLoginAttempts(userId: $userId) {
      id
      userId
      method
      ipAddress
      ipCountry
      userAgent
      failureReason
      failureDetails
      loggedInAt
    }
  }
`;

export const RISKY_LOGIN_ALERTS_SUBSCRIPTION = gql`
  subscription RiskyLoginAlerts($userId: ID!) {
    riskyLoginAlerts(userId: $userId) {
      id
      userId
      ipAddress
      ipCountry
      riskScore
      riskFactors
      isVpn
      isTor
      isProxy
      requiresMfa
      mfaCompleted
      loggedInAt
      flaggedBy {
        id
        email
      }
      flaggedReason
    }
  }
`;
