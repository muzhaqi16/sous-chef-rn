import {gql} from '@apollo/client';

export const MARK_NOTIFICATION_READ = gql`
  mutation markNotificationAsRead($id: ID!) {
    markNotificationAsRead(id: $id) {
      id
      userId
      type
      payload
      status
      sentAt
      readAt
      createdAt
    }
  }
`;

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($id: ID!) {
    deleteNotification(id: $id)
  }
`;
