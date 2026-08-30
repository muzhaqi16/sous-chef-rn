/**
 * Client-side list filtering: a fast substring check first, then a strict Fuse
 * fuzzy match so a one-character typo ("tomatoe" → "Tomato") still matches.
 */

import Fuse from 'fuse.js';

const FUZZY_THRESHOLD = 0.3;

const fuzzyMatch = (
  text: string | null | undefined,
  query: string,
): boolean => {
  if (!text || !query) return false;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerText.includes(lowerQuery)) return true;

  // Fuse construction over a single-element collection is cheap; the
  // index has only one record. Only the typo path pays for this.
  const fuse = new Fuse([text], { threshold: FUZZY_THRESHOLD });
  return fuse.search(query).length > 0;
};

export const createItemNameSearch = <T extends { itemName?: string | null }>(
  item: T,
  query: string,
): boolean => fuzzyMatch(item?.itemName, query);

export const createCategorySearch = <T extends { category?: string | null }>(
  item: T,
  query: string,
): boolean => fuzzyMatch(item?.category, query);

export const shoppingListItemSearch = <
  T extends { itemName?: string | null; category?: string | null },
>(
  item: T,
  query: string,
): boolean => {
  const trimmed = query.trim();
  if (!trimmed) return true;
  return (
    fuzzyMatch(item?.itemName, trimmed) || fuzzyMatch(item?.category, trimmed)
  );
};

export const pantryItemSearch = <T extends { itemName?: string | null }>(
  item: T,
  query: string,
): boolean => {
  const trimmed = query.trim();
  if (!trimmed) return true;
  return fuzzyMatch(item?.itemName, trimmed);
};
