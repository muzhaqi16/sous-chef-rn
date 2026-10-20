import { useEffect } from 'react';
import type { MissingTree } from '@apollo/client/cache';
import { Telemetry } from '#/services/telemetry';

const reported = new Set<string>();

/**
 * Reports, once per fragment while the app runs, a list cell that renders
 * nothing because its entity is cached without fields the cell reads: a field
 * its list does not fetch. A row deleted mid-update is missing whole, which
 * Apollo reports as a string rather than a tree, so it is not reported.
 */
export function useIncompleteCellReport(
  fragmentName: string,
  missing: MissingTree | undefined,
): void {
  const fields =
    typeof missing === 'object' ? Object.keys(missing).sort().join(',') : '';

  useEffect(() => {
    if (!fields || reported.has(fragmentName)) return;
    reported.add(fragmentName);
    Telemetry.warn('List cell blank: its cached entity lacks fields', {
      fragment: fragmentName,
      fields,
    });
  }, [fragmentName, fields]);
}
