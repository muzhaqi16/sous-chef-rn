/**
 * Only the viewer's own private item is written directly: a PUBLIC item
 * (`canSuggest`) is only suggested to, even when `canEdit` says admin, since
 * catalog administration belongs to the admin app.
 */
export const writesItemDirectly = (item: {
  canEdit?: boolean | null;
  canSuggest?: boolean | null;
}): boolean => item.canEdit === true && item.canSuggest !== true;
