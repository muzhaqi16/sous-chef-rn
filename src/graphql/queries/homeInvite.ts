import {gql} from '@apollo/client';

export const GET_HOME_INVITES = gql`
  query HomeInvites($homeId: ID!) {
    homeInvites(homeId: $homeId) {
      id
      email
      token
      homeId
      home {
        name
      }
      invitedUserId
      inviter {
        profile {
          displayName
        }
      }

      recipientName
      role
      customPermissions
      status
      expiresAt
      sentAt
      lastReminderAt
      reminderCount
      acceptedAt
      declinedAt
      revokedAt
      personalMessage
      createdAt
    }
  }
`;
