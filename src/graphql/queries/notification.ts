import {gql} from '@apollo/client';

export const GET_MY_NOTIFICATIONS = gql`
  query MyNotifications(
    $filter: NotificationFilterInput
    $first: Int
    $after: String
    $last: Int
    $before: String
    $orderBy: NotificationOrderBy
  ) {
    myNotifications(
      filter: $filter
      first: $first
      after: $after
      last: $last
      before: $before
      orderBy: $orderBy
    ) {
      edges {
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
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
      unreadCount
    }
  }
`;
