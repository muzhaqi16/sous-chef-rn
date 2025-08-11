import {gql} from '@apollo/client';

export const STORE_UPDATED_SUBSCRIPTION = gql`
  subscription StoreUpdated($storeId: ID) {
    storeUpdated(storeId: $storeId) {
      id
      name
      address
      priceAccuracy
      lastPriceUpdate
      qualityRating
      chain
      city
      state
      zipCode
      latitude
      longitude
      phone
      website
      isActive
      updatedAt
    }
  }
`;

export const STORE_RATING_CHANGED_SUBSCRIPTION = gql`
  subscription StoreRatingChanged($storeId: ID) {
    storeRatingChanged(storeId: $storeId) {
      id
      name
      qualityRating
      priceAccuracy
      updatedAt
    }
  }
`;
