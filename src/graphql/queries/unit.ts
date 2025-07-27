import {gql} from '@apollo/client';
export const GET_UNITS = gql`
  query Units {
    units {
      id
      name
      symbol
      type
      conversionFactor
      notes
    }
  }
`;
