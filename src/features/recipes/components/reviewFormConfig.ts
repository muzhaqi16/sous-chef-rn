import { number, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

export interface ReviewFormValues {
  /** 0 until a star is picked. */
  rating: number;
  comment: string;
}

export const reviewSchema: ObjectSchema<ReviewFormValues> = object({
  rating: number().defined().min(1, lazyMessage('recipes.ratingRequired')),
  comment: string().trim().defined(),
});
