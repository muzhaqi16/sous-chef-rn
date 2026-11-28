import { object } from 'yup';
import { homeNameRule } from '#utils/validation/common';

export const renameHomeSchema = object({ name: homeNameRule });
