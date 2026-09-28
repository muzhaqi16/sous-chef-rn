import { extractNodes } from '#/utils/connectionUtils';

interface PantryNode {
  id: string;
  isDefault?: boolean | null;
}

/** Any read of a home that selects its pantries connection. */
export interface HomePantries<P extends PantryNode = PantryNode> {
  pantriesConnection?: {
    edges?: Array<{ node?: P | null } | null> | null;
  } | null;
}

export const pantriesOf = <P extends PantryNode>(
  home: HomePantries<P> | null | undefined,
): P[] => extractNodes(home?.pantriesConnection);

/** The pantry a home opens on: its default, else its first. */
export const defaultPantryOf = <P extends PantryNode>(
  home: HomePantries<P> | null | undefined,
): P | undefined => {
  const pantries = pantriesOf(home);
  return pantries.find(p => p.isDefault) ?? pantries[0];
};
