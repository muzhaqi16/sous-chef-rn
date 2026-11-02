/**
 * Within one page the client holds the whole dataset and can sort/filter
 * locally; past it the client has only a window, so the server must do both.
 */
export function shouldUseServerSort(
  totalCount: number,
  pageSize: number,
  serverAvailable: boolean,
): boolean {
  return serverAvailable && totalCount > pageSize;
}
