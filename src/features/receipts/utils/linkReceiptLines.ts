import type { ReceiptLineChoice } from '../store/receiptDraftStore';

/** An open line of the shopping list, as matching reads it. */
export interface OpenListLine {
  id: string;
  item: { id: string } | null;
  unit: { id: string; name: string; symbol: string } | null;
}

/**
 * A move records the purchase in a unit by id, or in the list line's own. A
 * picked unit fits a line in that unit or in none; a typed one only a line in
 * that unit, whose id the move then carries; no unit takes the line's.
 */
function unitFits(choice: ReceiptLineChoice, line: OpenListLine): boolean {
  if (choice.unitId) return !line.unit || choice.unitId === line.unit.id;
  const typed = choice.unitText.trim().toLowerCase();
  if (!typed) return true;
  return (
    !!line.unit &&
    (line.unit.symbol.toLowerCase() === typed ||
      line.unit.name.toLowerCase() === typed)
  );
}

/** The open list line a chosen receipt line is for: the same catalog item, in a unit it fits. */
export function listLineFor<Line extends OpenListLine>(
  choice: ReceiptLineChoice,
  lines: readonly Line[],
): Line | undefined {
  const { itemId } = choice;
  if (!itemId) return undefined;
  return lines.find(line => line.item?.id === itemId && unitFits(choice, line));
}

/**
 * Each chosen receipt line's open list line, one to one, in receipt order. A
 * line the user keeps off the list takes none, leaving it for another.
 */
export function linkReceiptLines<Line extends OpenListLine>(
  chosen: readonly { index: number; choice: ReceiptLineChoice }[],
  lines: readonly Line[],
): Map<number, Line> {
  const links = new Map<number, Line>();
  let open = lines;
  for (const { index, choice } of chosen) {
    if (choice.offList) continue;
    const line = listLineFor(choice, open);
    if (!line) continue;
    links.set(index, line);
    open = open.filter(candidate => candidate !== line);
  }
  return links;
}
