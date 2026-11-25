import { object, string, type ObjectSchema } from 'yup';
import { DIETARY_LIMITS } from '#domain/dietary';
import { lazyMessage } from '#utils/validation/common';

export interface CookingPreferencesFormValues {
  /** Minutes as typed; blank is no limit. */
  cookTime: string;
}

export const cookingPreferencesSchema: ObjectSchema<CookingPreferencesFormValues> =
  object({
    cookTime: string()
      .defined()
      .test(
        'within-range',
        lazyMessage(
          'cookingPreferences.cookTimeRange',
          DIETARY_LIMITS.cookTime,
        ),
        value => {
          if (!value) return true;
          const minutes = parseInt(value);
          const { min, max } = DIETARY_LIMITS.cookTime;
          return !isNaN(minutes) && minutes >= min && minutes <= max;
        },
      ),
  });
