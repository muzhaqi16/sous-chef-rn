import {gql} from '@apollo/client';

const NOTIFICATION_SUBSCRIPTION_FRAGMENT = gql`
  fragment NotificationSubscription on NotificationSubscriptionPayload {
    mutation
    node {
      id
      userId
      type
      payload
      status
      sentAt
      readAt
      createdAt
    }
    previousValues {
      id
      userId
      type
      payload
      status
      sentAt
      readAt
      createdAt
    }
    updatedFields
  }
`;

export const NOTIFICATION_CREATED_SUBSCRIPTION = gql`
  subscription NotificationCreated {
    notificationCreated {
      ...NotificationSubscription
    }
  }
`;

export const NOTIFICATION_READ_SUBSCRIPTION = gql`
  subscription NotificationRead {
    notificationRead {
      ...NotificationSubscription
    }
  }
`;

export const NOTIFICATION_UPDATED_SUBSCRIPTION = gql`
  subscription NotificationUpdated {
    notificationUpdated {
      ...NotificationSubscription
    }
  }
`;

export const NOTIFICATION_DELETED_SUBSCRIPTION = gql`
  subscription NotificationDeleted {
    notificationDeleted {
      ...NotificationSubscription
    }
  }
`;
