import { RecurringPattern } from '#/graphql/generated/schemaTypes';
import {
  listFromTemplate,
  type CopyableList,
  type DerivedList,
} from './listFromTemplate';

/** How one interval of a pattern carries a date forward. */
type RecurrenceAdvance = (from: Date, interval: number) => Date;

const byDays =
  (daysPerPeriod: number): RecurrenceAdvance =>
  (from, interval) => {
    const next = new Date(from);
    next.setDate(from.getDate() + interval * daysPerPeriod);
    return next;
  };

/**
 * Where one interval lands, per pattern — the client half of the server's
 * `RECURRENCE_ADVANCE`. `CUSTOM` counts days, which is what an interval means
 * when the pattern names no larger period.
 */
const RECURRENCE_ADVANCE = {
  [RecurringPattern.Daily]: byDays(1),
  [RecurringPattern.Weekly]: byDays(7),
  [RecurringPattern.Biweekly]: byDays(14),
  [RecurringPattern.Custom]: byDays(1),
  [RecurringPattern.Monthly]: (from: Date, interval: number) => {
    const next = new Date(from);
    next.setMonth(from.getMonth() + interval);
    return next;
  },
} satisfies Record<RecurringPattern, RecurrenceAdvance>;

/** A list with no pattern advances by days, as the server's null arm does. */
export function advanceRecurringDate(
  pattern: RecurringPattern | null | undefined,
  interval: number,
  from: Date,
): Date {
  return (pattern ? RECURRENCE_ADVANCE[pattern] : byDays(1))(from, interval);
}

export interface DerivedRecurringList extends DerivedList {
  /** Where the source list's `nextRecurringDate` pointer moves to. */
  nextRecurringDate: string;
}

interface RollOptions {
  pattern: RecurringPattern | null | undefined;
  /** Absent counts as zero, matching the server's `?? 0`. */
  interval: number | null | undefined;
  /** Already resolved and localized by the caller. */
  name: string;
  now?: Date;
  mintId?: () => string;
}

/**
 * The next occurrence of a recurring list: a copy of it, plus where the
 * recurrence pointer moves to. Mirrors
 * `ShoppingListService.generateNextRecurringList`, except that the server also
 * stamps `lastRecurredAt`, which no client input reaches.
 */
export function nextRecurringList(
  source: CopyableList,
  options: RollOptions,
): DerivedRecurringList {
  const from = options.now ?? new Date();
  return {
    ...listFromTemplate(source, {
      name: options.name,
      ...(options.mintId && { mintId: options.mintId }),
    }),
    nextRecurringDate: advanceRecurringDate(
      options.pattern,
      options.interval ?? 0,
      from,
    ).toISOString(),
  };
}
