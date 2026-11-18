import { element, by, waitFor } from 'detox';
import { asTestUser, payloadOf } from './api';
import { retry } from './waitFor';
import { homeTestIDs } from '../../src/features/home/testIDs';
import { todayTestIDs } from '../../src/features/today/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

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

// `generateItemName`'s shape, `<Prefix> Item <epoch ms>`.
const SPEC_HOME = /^\w+ Item (\d{13})$/;
// Longer than any spec runs (specs run one at a time), so an older one is left over.
const LEFT_OVER_AFTER_MS = 15 * 60 * 1000;

async function deleteHome(homeId: string): Promise<void> {
  const { deleteHome: deleted } = await asTestUser<{
    deleteHome: { __typename: string };
  }>(
    `mutation ($input: DeleteHomeInput!) { deleteHome(input: $input) { __typename ${ERROR} } }`,
    { input: { id: homeId } },
  );
  payloadOf(deleted, 'DeleteHomePayload');
}

/**
 * Deletes the homes earlier specs opened and never closed, as when the API went
 * away before their `afterAll`. A left-over home can stay the account's default,
 * which the next spec would then restore as the default it found.
 */
/**
 * Deletes the spec homes left over long enough to be no running spec's, and
 * answers the home a spec restores as default on closing: the account's own,
 * never a spec home (a left-over one would be restored by every spec after it).
 */
async function deleteLeftOverHomes(): Promise<string | null> {
  const { homes } = await asTestUser<{
    homes: {
      edges: { node: { id: string; name: string; isDefault: boolean } }[];
    };
  }>('{ homes(first: 50) { edges { node { id name isDefault } } } }');
  const all = homes.edges.map(edge => edge.node);
  const now = Date.now();
  const leftOver = all.filter(home => {
    const opened = SPEC_HOME.exec(home.name)?.[1];
    return opened !== undefined && now - Number(opened) > LEFT_OVER_AFTER_MS;
  });
  const kept = all.find(home => !SPEC_HOME.test(home.name));
  if (kept && leftOver.some(home => home.isDefault)) await markDefault(kept.id);
  for (const home of leftOver) await deleteHome(home.id);
  const current = all.find(home => home.isDefault);
  return current && !SPEC_HOME.test(current.name)
    ? current.id
    : kept?.id ?? null;
}

export async function openTrackingHome(name: string): Promise<TrackingHome> {
  const accountDefault = await deleteLeftOverHomes();
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
    previousDefaultHomeId: accountDefault,
  };
}

export async function closeTrackingHome(home: TrackingHome): Promise<void> {
  if (home.previousDefaultHomeId) await markDefault(home.previousDefaultHomeId);
  await deleteHome(home.homeId);
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
/** Packages, each holding `size`, counted in `unit` (a COUNT unit such as carton). */
export interface SeededPackages {
  count: number;
  unit: string;
  size: { quantity: number; unit: string };
}

/** A stack measured in `unit`, or of `packages` of a stated size. */
export async function seedStack(
  pantryId: string,
  stack: { name: string; expiresOn?: string } & (
    | { quantity: number; unit: string }
    | { packages: SeededPackages }
  ),
): Promise<SeededStack> {
  const amount =
    'packages' in stack
      ? {
          amount: {
            packages: {
              count: stack.packages.count,
              unitId: await unitId(stack.packages.unit),
              size: {
                netWeight: stack.packages.size.quantity,
                netWeightUnitId: await unitId(stack.packages.size.unit),
              },
            },
          },
        }
      : { quantity: stack.quantity, unit: { id: await unitId(stack.unit) } };
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
        ...amount,
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
  ingredients: {
    name: string;
    itemId: string;
    quantity: number;
    unit: string;
  }[];
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

/** A stack as the API holds it, with what one package holds and what was paid. */
export interface StackOnServer {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  netWeight: number | null;
  netWeightUnit: string | null;
  remainingNetWeight: number | null;
  /** The amount a person reads as left (`PantryItem.amountLeft`). */
  amountLeft: { value: number; unit: string };
  /** What is held in `unit`, a part-used package as its fraction (0.875 carton). */
  heldQuantity: number;
  /** Packages not yet opened. */
  fullPackages: number;
  /** Physical containers held: one batch each. */
  activeBatchCount: number;
  totalPaid: number | null;
}

/** Every stack of a pantry, as the API holds it. */
export async function pantryStacks(pantryId: string): Promise<StackOnServer[]> {
  type Node = {
    id: string;
    itemName: string;
    quantity: number;
    unit: { symbol: string };
    netWeight: number | null;
    netWeightUnit: { symbol: string } | null;
    remainingNetWeight: number | null;
    amountLeft: { value: number; unit: { symbol: string } };
    heldQuantity: number;
    stockBreakdown: { fullPackages: number };
    activeBatchCount: number;
    purchase: { totalPrice: number | null } | null;
  };
  const { pantry } = await asTestUser<{
    pantry: { itemsConnection: { edges: { node: Node }[] } } | null;
  }>(
    `query ($id: ID!) { pantry(id: $id) { id itemsConnection(first: 50) { edges { node {
      id itemName quantity unit { symbol } netWeight netWeightUnit { symbol }
      remainingNetWeight amountLeft { value unit { symbol } }
      heldQuantity stockBreakdown { fullPackages } activeBatchCount
      purchase { id totalPrice }
    } } } } }`,
    { id: pantryId },
  );
  if (!pantry) throw new Error(`No pantry ${pantryId}`);
  return pantry.itemsConnection.edges.map(({ node }) => ({
    id: node.id,
    itemName: node.itemName,
    quantity: node.quantity,
    unit: node.unit.symbol,
    netWeight: node.netWeight,
    netWeightUnit: node.netWeightUnit?.symbol ?? null,
    remainingNetWeight: node.remainingNetWeight,
    amountLeft: {
      value: node.amountLeft.value,
      unit: node.amountLeft.unit.symbol,
    },
    heldQuantity: node.heldQuantity,
    fullPackages: node.stockBreakdown.fullPackages,
    activeBatchCount: node.activeBatchCount,
    totalPaid: node.purchase?.totalPrice ?? null,
  }));
}

/** What a stack's history records, oldest first: the add that made it, then each use. */
export async function historyOnServer(
  stackId: string,
): Promise<{ quantityUsed: number; unit: string | null; usedAt: string }[]> {
  type Node = {
    quantityUsed: number;
    usedAt: string;
    usageUnit: { symbol: string } | null;
  };
  const { pantryItem } = await asTestUser<{
    pantryItem: { usageRecordsConnection: { edges: { node: Node }[] } } | null;
  }>(
    `query ($id: ID!) { pantryItem(id: $id) { id usageRecordsConnection(first: 20) { edges { node {
      id quantityUsed usedAt usageUnit { id symbol }
    } } } } }`,
    { id: stackId },
  );
  if (!pantryItem) throw new Error(`No stack ${stackId}`);
  return pantryItem.usageRecordsConnection.edges
    .map(({ node }) => node)
    .sort((a, b) => a.usedAt.localeCompare(b.usedAt))
    .map(node => ({
      quantityUsed: node.quantityUsed,
      unit: node.usageUnit?.symbol ?? null,
      usedAt: node.usedAt,
    }));
}

/** Uses `quantity` of a stack through the API, as another member's device would. */
export async function useOnServer(
  stackId: string,
  quantity: number,
): Promise<void> {
  const { createPantryItemUsage } = await asTestUser<{
    createPantryItemUsage: { __typename: string };
  }>(
    `mutation ($input: CreatePantryItemUsageInput!) { createPantryItemUsage(input: $input) { __typename ${ERROR} } }`,
    {
      input: {
        pantryItemId: stackId,
        amount: { quantity },
        purpose: 'GENERAL',
        today: localDate(),
      },
    },
  );
  payloadOf(createPantryItemUsage, 'CreatePantryItemUsagePayload');
}

/** When the API last had the stack's amount confirmed, and how much it holds. */
export async function confidenceOnServer(
  stackId: string,
): Promise<{ quantity: number; lastConfirmedAt: string }> {
  const { pantryItem } = await asTestUser<{
    pantryItem: {
      quantity: number;
      stockConfidence: { lastConfirmedAt: string };
    } | null;
  }>(
    'query ($id: ID!, $today: LocalDate!) { pantryItem(id: $id) { id quantity stockConfidence(today: $today) { lastConfirmedAt } } }',
    { id: stackId, today: localDate() },
  );
  if (!pantryItem) throw new Error(`No stack ${stackId}`);
  return {
    quantity: pantryItem.quantity,
    lastConfirmedAt: pantryItem.stockConfidence.lastConfirmedAt,
  };
}

/** Every stack of a home, as id, amount and unit: what a spec must leave as it was. */
export async function homeStock(
  homeId: string,
): Promise<{ id: string; quantity: number; unit: string }[]> {
  const { home } = await asTestUser<{
    home: { pantriesConnection: { edges: { node: { id: string } }[] } } | null;
  }>(
    'query ($id: ID!) { home(id: $id) { id pantriesConnection(first: 20) { edges { node { id } } } } }',
    { id: homeId },
  );
  if (!home) throw new Error(`No home ${homeId}`);
  const stacks = await Promise.all(
    home.pantriesConnection.edges.map(({ node }) => pantryStacks(node.id)),
  );
  return stacks
    .flat()
    .map(({ id, quantity, unit }) => ({ id, quantity, unit }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Shows `homeId` in the app: the app opens on the home it last showed, and
 * choosing a home as default in My Homes selects it, as a household switching
 * homes does. Ends back where My Homes was opened from.
 */
export async function selectHome(homeId: string, timeout = 15000) {
  await waitFor(element(by.id(todayTestIDs.householdTitle)))
    .toBeVisible()
    .withTimeout(timeout);
  await element(by.id(todayTestIDs.householdTitle)).tap();
  await waitFor(element(by.id(homeTestIDs.managementScroll)))
    .toBeVisible()
    .withTimeout(timeout);
  const setDefault = homeTestIDs.setDefaultButton(homeId);
  // The list opens from the cache; a home made since needs the read's answer.
  try {
    await waitFor(element(by.id(setDefault)))
      .toExist()
      .withTimeout(5000);
  } catch {
    await element(by.id(homeTestIDs.managementScroll)).swipe('down', 'slow');
    await waitFor(element(by.id(setDefault)))
      .toExist()
      .withTimeout(timeout);
  }
  await waitFor(element(by.id(setDefault)))
    .toBeVisible()
    .whileElement(by.id(homeTestIDs.managementScroll))
    .scroll(250, 'down');
  await element(by.id(setDefault)).tap();
  // Confirmed by the server, not by the star leaving the screen: a list that
  // re-renders hides it for a moment whether or not the tap landed.
  await retry(async () => {
    const { me } = await asTestUser<{ me: { defaultHomeId: string | null } }>(
      '{ me { id defaultHomeId } }',
    );
    if (me.defaultHomeId !== homeId) {
      throw new Error(`The default home is ${me.defaultHomeId}, not ${homeId}`);
    }
  }, 10);
  await element(by.id(kitTestIDs.headerBackButton)).tap();
  await waitFor(element(by.id(todayTestIDs.householdTitle)))
    .toBeVisible()
    .withTimeout(timeout);
}
