/**
 * The minimum every refusal reader needs. Narrow ON PURPOSE: declared as a
 * hook's return type, it keeps the awaiting screen off the data library's own
 * result generics, which name the client.
 */
export interface MutationOutcome<TData = unknown> {
  data?: TData | null;
  error?: unknown;
}
