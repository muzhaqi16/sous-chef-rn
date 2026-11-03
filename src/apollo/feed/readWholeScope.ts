import { SyncPageStatus } from '#/graphql/generated/schemaTypes';
import type { FeedAnswer } from './types';

interface SnapshotPage<Row> {
  status: SyncPageStatus;
  cursor?: string | null;
  endCursor?: string | null;
  hasMore: boolean;
  rows: readonly Row[];
}

interface PageAnswer<Row> {
  data?: { syncSnapshot: SnapshotPage<Row> } | undefined;
  error?: unknown;
}

/** A scope read in full: its status, the first page's cursor and every row. */
interface WholeScope<Row> {
  status: SyncPageStatus;
  cursor: string | null;
  rows: Row[];
}

/** Reads a scope's snapshot to its end, one page after another. */
export async function readWholeScope<Row>(
  readPage: (after: string | null) => Promise<PageAnswer<Row>>,
): Promise<FeedAnswer<WholeScope<Row>>> {
  const rows: Row[] = [];
  let cursor: string | null = null;
  let after: string | null = null;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await readPage(after);
    if (error || !data) return { error };
    const page = data.syncSnapshot;
    if (page.status !== SyncPageStatus.Current) {
      return { data: { status: page.status, cursor: null, rows: [] } };
    }
    // Later pages answer none: the first page's was taken before any row.
    cursor ??= page.cursor ?? null;
    rows.push(...page.rows);
    ({ hasMore } = page);
    after = page.endCursor ?? null;
    if (hasMore && !after) {
      return { error: new Error('Snapshot lost its place') };
    }
  }
  return { data: { status: SyncPageStatus.Current, cursor, rows } };
}
