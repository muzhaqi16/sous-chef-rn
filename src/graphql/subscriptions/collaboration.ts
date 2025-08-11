import {gql} from '@apollo/client';

export const COLLABORATION_MEMBER_ADDED_SUBSCRIPTION = gql`
  subscription CollaborationMemberAdded($shoppingListId: ID!, $email: String!) {
    collaborationMemberAdded(shoppingListId: $shoppingListId, email: $email) {
      id
      shoppingListId
      collaboratorId
      email
      role
      status
      canEdit
      canAddItems
      canRemoveItems
      canMarkPurchased
      canInviteOthers
      invitedAt
      shoppingList {
        id
        name
      }
      collaborator {
        id
        email
        profile {
          displayName
          avatar
        }
      }
      invitedBy {
        id
        email
        profile {
          displayName
        }
      }
    }
  }
`;

export const COLLABORATION_MEMBER_REMOVED_SUBSCRIPTION = gql`
  subscription CollaborationMemberRemoved(
    $shoppingListId: ID!
    $email: String!
  ) {
    collaborationMemberRemoved(shoppingListId: $shoppingListId, email: $email) {
      id
      email
      collaboratorId
      shoppingList {
        id
        name
      }
    }
  }
`;

export const COLLABORATION_INVITE_SENT_SUBSCRIPTION = gql`
  subscription CollaborationInviteSent($shoppingListId: ID!, $email: String!) {
    collaborationInviteSent(shoppingListId: $shoppingListId, email: $email) {
      id
      shoppingListId
      email
      role
      status
      inviteToken
      invitedAt
      expiresAt
      shoppingList {
        id
        name
      }
      invitedBy {
        id
        email
        profile {
          displayName
        }
      }
    }
  }
`;
