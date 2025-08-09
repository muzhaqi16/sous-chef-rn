import {gql} from '@apollo/client';

export const CREATE_HOME = gql`
  mutation CreateHome($input: CreateHomeInput!) {
    createHome(input: $input) {
      id
      name
      description
      type
      currency
      timezone
      isPublic
      allowJoinCode
      joinCode
      maxMembers
      tags
      createdAt
      updatedAt
      pantries {
        id
        name
        isDefault
      }
      members {
        id
        email
      }
    }
  }
`;

export const INVITE_TO_HOME = gql`
  mutation InviteToHome($input: InviteToHomeInput!) {
    inviteToHome(input: $input) {
      id
      email
      token
      homeId
      role
      status
      expiresAt
      sentAt
      personalMessage
      createdAt
      home {
        id
        name
      }
      inviter {
        id
        email
      }
    }
  }
`;
