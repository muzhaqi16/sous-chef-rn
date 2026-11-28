import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';
import { httpUrl } from '#features/recipes/screens/RecipeForm/recipeFormConfig';

export type CaptureSheetKind = 'link' | 'text';

export interface CaptureFormValues {
  url: string;
  text: string;
  sourceUrl: string;
}

/** What the schema reads beyond the form: which field the sheet shows. */
export interface CaptureFormContext {
  kind: CaptureSheetKind;
}

export const captureFormDefaults: CaptureFormValues = {
  url: '',
  text: '',
  sourceUrl: '',
};

const shows = (
  options: { context?: Partial<CaptureFormContext> },
  kind: CaptureSheetKind,
) => options.context?.kind === kind;

// Only the field the sheet shows is needed; the other may hold what was typed
// before switching.
export const captureFormSchema: ObjectSchema<CaptureFormValues> = object({
  url: httpUrl('recipes.captureLinkInvalid').test(
    'shownNeeded',
    lazyMessage('recipes.captureLinkRequired'),
    (value, { options }) => !shows(options, 'link') || value.trim() !== '',
  ),
  text: string()
    .defined()
    .trim()
    .test(
      'shownNeeded',
      lazyMessage('recipes.captureTextRequired'),
      (value, { options }) => !shows(options, 'text') || value !== '',
    ),
  sourceUrl: httpUrl('recipes.captureLinkInvalid'),
});
