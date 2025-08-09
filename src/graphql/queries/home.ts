import {gql} from '@apollo/client';

export const GET_HOME = gql`
  query Home($homeId: ID!) {
    home(id: $homeId) {
      id
      name
      description
      type
      timezone
      currency
      isPublic
      joinCode
      allowJoinCode
      maxMembers
      tags
      metadata
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
      memberships {
        id
        homeId
        userId
        role
        status
        displayName
        canViewPantry
        canEditPantry
        canAddItems
        canRemoveItems
        canInviteOthers
        canManageHome
        lastActiveAt
        joinedAt
        leftAt
        createdAt
        updatedAt
        user {
          id
          email
        }
      }
    }
  }
`;

export const GET_HOMES = gql`
  query Homes {
    homes {
      id
      name
      createdAt
      updatedAt
    }
  }
`;
