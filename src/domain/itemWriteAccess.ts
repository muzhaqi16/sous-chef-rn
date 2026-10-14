/**
 * Whether the app writes a catalog item directly: only the viewer's own private
 * item. A PUBLIC item (`canSuggest`) is only ever suggested to, even when
 * `canEdit` says the viewer is an admin. Catalog administration belongs to the
 * admin app, never the phone.
 */
export const writesItemDirectly = (item: {
  canEdit?: boolean | null;
  canSuggest?: boolean | null;
}): boolean => item.canEdit === true && item.canSuggest !== true;
