import type { ApolloCache, Reference } from '@apollo/client';
import { gql } from '@apollo/client';
import { safeEvict, type ConnectionData } from '#/apollo/utils/cacheUpdaters';

const RATING_BUCKETS: readonly (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

const ratingCountField = (rating: number): string | null => {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return `rating${rating}Count`;
};

const ReviewRatingFragment = gql`
  fragment _RecipeReviewRating on RecipeReview {
    id
    rating
  }
`;

const RecipeRatingCountsFragment = gql`
  fragment _RecipeRatingCounts on Recipe {
    totalReviews
    rating1Count
    rating2Count
    rating3Count
    rating4Count
    rating5Count
  }
`;

const recomputeAverageRating = (cache: ApolloCache, recipeId: string): void => {
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return;
  const counts = cache.readFragment<{
    totalReviews: number;
    rating1Count: number;
    rating2Count: number;
    rating3Count: number;
    rating4Count: number;
    rating5Count: number;
  }>({ id: cacheId, fragment: RecipeRatingCountsFragment });
  if (!counts) return;
  const total = RATING_BUCKETS.reduce(
    (sum, n) => sum + (counts[`rating${n}Count` as keyof typeof counts] ?? 0),
    0,
  );
  const weighted = RATING_BUCKETS.reduce(
    (sum, n) =>
      sum + (counts[`rating${n}Count` as keyof typeof counts] ?? 0) * n,
    0,
  );
  const average = total === 0 ? 0 : weighted / total;
  cache.modify({ id: cacheId, fields: { averageRating: () => average } });
};

const addReviewEdge = (
  cache: ApolloCache,
  recipeId: string,
  reviewId: string,
): void => {
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return;
  cache.modify({
    id: cacheId,
    fields: {
      reviews(existing: ConnectionData = {}, { toReference, readField }) {
        const newRef = toReference({
          __typename: 'RecipeReview',
          id: reviewId,
        });
        if (!newRef) return existing;
        const existingEdges = existing.edges || [];
        const alreadyPresent = existingEdges.some(
          edge => readField('id', edge?.node) === reviewId,
        );
        if (alreadyPresent) return existing;
        const newEdge = {
          __typename: 'RecipeReviewEdge',
          node: newRef as Reference,
          cursor: '',
        };
        return {
          ...existing,
          edges: [newEdge, ...existingEdges],
          totalCount: (existing.totalCount ?? 0) + 1,
        };
      },
    },
  });
};

const removeReviewEdge = (
  cache: ApolloCache,
  recipeId: string,
  reviewId: string,
): void => {
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return;
  cache.modify({
    id: cacheId,
    fields: {
      reviews(existing: ConnectionData = {}, { readField }) {
        const existingEdges = existing.edges || [];
        const edges = existingEdges.filter(
          edge => readField('id', edge?.node) !== reviewId,
        );
        if (edges.length === existingEdges.length) return existing;
        return {
          ...existing,
          edges,
          totalCount: Math.max(0, (existing.totalCount ?? 0) - 1),
        };
      },
    },
  });
};

/**
 * Add a new review to a Recipe's reviews connection and update aggregates.
 * Server-side `averageRating` may use a different formula; cache-and-network
 * background refetch reconciles any drift.
 */
export const addReviewToRecipe = (
  cache: ApolloCache,
  recipeId: string,
  review: { id: string; rating: number },
): void => {
  const countField = ratingCountField(review.rating);
  if (!countField) return;
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return;
  addReviewEdge(cache, recipeId, review.id);
  cache.modify({
    id: cacheId,
    fields: {
      totalReviews: (existing: number = 0) => existing + 1,
      [countField]: (existing: number = 0) => existing + 1,
    },
  });
  recomputeAverageRating(cache, recipeId);
};

/**
 * Adjust aggregates when a review's rating changes. Reads the prior rating
 * from cache via `getReviewRating` before the mutation fires.
 */
export const changeReviewRating = (
  cache: ApolloCache,
  recipeId: string,
  prevRating: number,
  nextRating: number,
): void => {
  if (prevRating === nextRating) return;
  const prevField = ratingCountField(prevRating);
  const nextField = ratingCountField(nextRating);
  if (!prevField || !nextField) return;
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return;
  cache.modify({
    id: cacheId,
    fields: {
      [prevField]: (existing: number = 0) => Math.max(0, existing - 1),
      [nextField]: (existing: number = 0) => existing + 1,
    },
  });
  recomputeAverageRating(cache, recipeId);
};

/**
 * Remove a review from a Recipe's reviews connection, evict the entity,
 * and update aggregates. Reads the review's rating from cache before evict.
 */
export const removeReviewFromRecipe = (
  cache: ApolloCache,
  recipeId: string,
  reviewId: string,
): void => {
  const rating = getReviewRating(cache, reviewId);
  removeReviewEdge(cache, recipeId, reviewId);
  safeEvict(cache, 'RecipeReview', reviewId);
  if (rating === null) return;
  const countField = ratingCountField(rating);
  if (!countField) return;
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return;
  cache.modify({
    id: cacheId,
    fields: {
      totalReviews: (existing: number = 0) => Math.max(0, existing - 1),
      [countField]: (existing: number = 0) => Math.max(0, existing - 1),
    },
  });
  recomputeAverageRating(cache, recipeId);
};

/**
 * Read the rating currently cached for a review, to capture it before an update
 * changes the rating field.
 */
export const getReviewRating = (
  cache: ApolloCache,
  reviewId: string,
): number | null => {
  const review = cache.readFragment<{ id: string; rating: number }>({
    id: cache.identify({ __typename: 'RecipeReview', id: reviewId }),
    fragment: ReviewRatingFragment,
    fragmentName: '_RecipeReviewRating',
  });
  return review?.rating ?? null;
};
