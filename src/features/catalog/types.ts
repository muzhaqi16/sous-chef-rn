import type { DataState } from '#hooks/data/useDataState';
import type { ImageFile } from '#/types/media';
import type { AddItemFormData } from '#/utils/items/createItemMapping';

/** A server refusal the user can fix, shown on the form field it names. */
export interface AddItemFieldRefusal {
  field: 'upc';
  message: string;
}

export interface SelectedImage extends ImageFile {
  perspective: string;
  /** The hero once uploaded. Set only under `allowPrimarySelection`, on exactly one image. */
  isPrimary?: boolean;
}

/**
 * The flat payload AddItemForm emits on submit; `mapFormToCreateItemInput`
 * turns it into the nested `CreateItemInput`. `AddItemFormData`'s index
 * signature is what lets extra fields (e.g. `editReason`) pass through.
 */
export type AddItemSubmitPayload = AddItemFormData & {
  selectedImages: SelectedImage[];
};

export interface BaseSuggestionItem {
  id: string;
  itemId: string;
  name: string;
  category?: string | null | undefined;
  imageUrl?: string | null | undefined;
  /** The row's own context ("2 L left"), shown in place of the category. */
  subtitle?: string | null | undefined;
}

export interface SuggestionsHookResult<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  grouped: Record<string, T[]>;
  /** A failed or offline read is its own state, never "No suggestions yet". */
  state: DataState;
  refetch: () => void;
}
