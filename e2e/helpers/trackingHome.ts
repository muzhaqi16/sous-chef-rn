import { asTestUser, payloadOf } from './api';

const ERROR = '... on Error { code message }';

/** The device's calendar date, which the API judges expiry and doubt by. */
export const localDate = (offsetDays = 0): string =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA');

/**
 * A home of its own for a spec, so its rows, stock check and suggestions hold
 * only what the spec seeds. The spec selects it in the app (`selectHome`); the
 * app keeps the home it started on until then. `closeTrackingHome` restores the
 * previous default and deletes it.
 */
export interface TrackingHome {
  homeId: string;
  pantryId: string;
  previousDefaultHomeId: string | null;
}

export async function openTrackingHome(name: string): Promise<TrackingHome> {
  const { me } = await asTestUser<{ me: { defaultHomeId: string | null } }>(
    '{ me { id defaultHomeId } }',
  );
  const { createHome } = await asTestUser<{
    createHome: {
      __typename: string;
      home?: {
        id: string;
        pantriesConnection: {
          edges: { node: { id: string; isDefault: boolean } }[];
        };
      };
    };
  }>(
    `mutation ($input: CreateHomeInput!) { createHome(input: $input) { __typename
      ... on CreateHomePayload { home { id pantriesConnection(first: 2) { edges { node { id isDefault } } } } }
      ${ERROR} } }`,
    { input: { name, createDefaultPantry: true } },
  );
  const home = payloadOf(createHome, 'CreateHomePayload').home;
  const pantries = home?.pantriesConnection.edges.map(edge => edge.node) ?? [];
  const pantry = pantries.find(node => node.isDefault) ?? pantries[0];
  if (!home || !pantry) throw new Error('The new home has no pantry');
  return {
    homeId: home.id,
    pantryId: pantry.id,
    previousDefaultHomeId: me.defaultHomeId,
  };
}

export async function closeTrackingHome(home: TrackingHome): Promise<void> {
  if (home.previousDefaultHomeId) await markDefault(home.previousDefaultHomeId);
  const { deleteHome } = await asTestUser<{
    deleteHome: { __typename: string };
  }>(
    `mutation ($input: DeleteHomeInput!) { deleteHome(input: $input) { __typename ${ERROR} } }`,
    { input: { id: home.homeId } },
  );
  payloadOf(deleteHome, 'DeleteHomePayload');
}

async function markDefault(homeId: string): Promise<void> {
  const { markHomeAsDefault } = await asTestUser<{
    markHomeAsDefault: { __typename: string };
  }>(
    `mutation ($input: MarkHomeAsDefaultInput!) { markHomeAsDefault(input: $input) { __typename ${ERROR} } }`,
    { input: { homeId } },
  );
  payloadOf(markHomeAsDefault, 'MarkHomeAsDefaultPayload');
}

const unitIds = new Map<string, string>();

export async function unitId(symbol: string): Promise<string> {
  const known = unitIds.get(symbol);
  if (known) return known;
  const { unitBySymbol } = await asTestUser<{
    unitBySymbol: { id: string } | null;
  }>('query ($symbol: String!) { unitBySymbol(symbol: $symbol) { id } }', {
    symbol,
  });
  if (!unitBySymbol) throw new Error(`No unit "${symbol}"`);
  unitIds.set(symbol, unitBySymbol.id);
  return unitBySymbol.id;
}

export interface SeededStack {
  id: string;
  itemId: string;
}

/** A stack of an item made for it, as a household adds one by hand. */
export async function seedStack(
  pantryId: string,
  stack: { name: string; quantity: number; unit: string; expiresOn?: string },
): Promise<SeededStack> {
  const { createPantryItem } = await asTestUser<{
    createPantryItem: {
      __typename: string;
      pantryItem?: { id: string; item: { id: string } };
    };
  }>(
    `mutation ($input: CreatePantryItemInput!) { createPantryItem(input: $input) { __typename
      ... on CreatePantryItemPayload { pantryItem { id item { id } } }
      ${ERROR} } }`,
    {
      input: {
        pantryId,
        item: { inline: { name: stack.name } },
        quantity: stack.quantity,
        unit: { id: await unitId(stack.unit) },
        today: localDate(),
        ...(stack.expiresOn ? { expiresOn: stack.expiresOn } : {}),
      },
    },
  );
  const created = payloadOf(createPantryItem, 'CreatePantryItemPayload');
  if (!created.pantryItem) throw new Error('No stack came back');
  return { id: created.pantryItem.id, itemId: created.pantryItem.item.id };
}

/** What the server holds for a stack now. */
export async function stackOnServer(
  id: string,
): Promise<{ quantity: number; unit: string }> {
  const { pantryItem } = await asTestUser<{
    pantryItem: { quantity: number; unit: { symbol: string } } | null;
  }>('query ($id: ID!) { pantryItem(id: $id) { quantity unit { symbol } } }', {
    id,
  });
  if (!pantryItem) throw new Error(`No stack ${id}`);
  return { quantity: pantryItem.quantity, unit: pantryItem.unit.symbol };
}

/** A private recipe whose ingredients name the seeded stacks' items. */
export async function seedRecipe(recipe: {
  name: string;
  servings: number;
  ingredients: { name: string; itemId: string; quantity: number; unit: string }[];
}): Promise<string> {
  const ingredients = await Promise.all(
    recipe.ingredients.map(async ingredient => ({
      name: ingredient.name,
      itemId: ingredient.itemId,
      quantity: ingredient.quantity,
      unitId: await unitId(ingredient.unit),
    })),
  );
  const { createRecipe } = await asTestUser<{
    createRecipe: { __typename: string; recipe?: { id: string } };
  }>(
    `mutation ($input: CreateRecipeInput!) { createRecipe(input: $input) { __typename
      ... on CreateRecipePayload { recipe { id } }
      ${ERROR} } }`,
    {
      input: {
        name: recipe.name,
        instructions: [{ step: 1, text: 'Cook it.' }],
        metadata: { servings: recipe.servings },
        ingredients,
      },
    },
  );
  const created = payloadOf(createRecipe, 'CreateRecipePayload');
  if (!created.recipe) throw new Error('No recipe came back');
  return created.recipe.id;
}
