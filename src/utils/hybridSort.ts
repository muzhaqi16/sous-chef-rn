/**
 * Determines whether sort/search should be handled server-side or client-side.
 *
 * When all items fit within a single page (totalCount ≤ pageSize), the client
 * already has the full dataset and can sort/filter locally — avoiding extra
 * network round-trips. When items exceed the page size, the server must handle
 * sort and search because the client only has a partial window.
 *
 * @param totalCount - Total number of items reported by the server
 * @param pageSize   - Page size used by the query (e.g. PAGE_SIZE.EXTENDED)
 * @param isOnline   - Whether the device is currently online
 * @returns true when the server should handle sort/search
 */
export function shouldUseServerSort(
  totalCount: number,
  pageSize: number,
  isOnline: boolean,
): boolean {
  return isOnline && totalCount > pageSize;
}
