import {gql} from '@apollo/client';

export const SYNC_HOME = gql`
  mutation SyncHome($home: SyncHomeInput!) {
    syncHome(home: $home)
  }
`;
