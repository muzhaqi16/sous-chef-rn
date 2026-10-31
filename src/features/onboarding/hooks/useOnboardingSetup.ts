import { skipToken, useQuery } from '@apollo/client/react';
import { t as tGlobal, useTranslation } from '#/i18n';
import { HomeType } from '#/graphql/generated/schemaTypes';
import { GetHomesDocument } from '#operations/home/home.generated';
import { defaultPantryOf } from '#domain/homePantries';
import { extractNodes } from '#/utils/connectionUtils';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { errorService } from '#/services/errorService';
import {
  useCreateHome,
  type CreateHomeFn,
} from '#features/home/hooks/useCreateHome';
import {
  useCreatePantry,
  type CreatePantryFn,
} from '#features/pantry/hooks/useCreatePantry';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import {
  useAppStore,
  useHasUnverifiedEmail,
  useSetSelectedPantryId,
  useUser,
} from '#store/useAppStore';

/** How setting up ended: ready, or refused with the reason to show. */
export type OnboardingSetupOutcome =
  | { status: 'done' }
  | { status: 'failed'; message: string };

type CreateShoppingListFn = ReturnType<
  typeof useCreateShoppingList
>['createShoppingList'];

interface SetupDeps {
  home: { id: string } | undefined;
  pantry: { id: string } | undefined;
  list: { id: string } | undefined;
  createMissingHome: boolean;
  homeName: string;
  hasUnverifiedEmail: boolean;
  createHome: CreateHomeFn;
  createPantry: CreatePantryFn;
  createShoppingList: CreateShoppingListFn;
  setSelectedHomeId: (id: string) => void;
  setSelectedPantryId: (id: string) => void;
  setSelectedShoppingListId: (id: string) => void;
  setupErrorMessage: string;
  pantryFailedMessage: string;
}

// A local-first create's minted id is the record's id whether the server
// answered or the write is queued, so offline setup still selects it.
async function createDefaultPantry(
  homeId: string,
  createPantry: CreatePantryFn,
): Promise<string | null> {
  try {
    const outcome = await createPantry({
      homeId,
      name: tGlobal('onBoarding.defaultPantryName'),
      description: tGlobal('onBoarding.defaultPantryDescription'),
      isDefault: true,
      tags: ['default', 'onboarding'],
    });
    return outcome.status === 'rejected' ? null : outcome.id;
  } catch (error) {
    errorService.reportError(error, { operation: 'createPantry' });
    return null;
  }
}

/** Module scope so the awaits do not bail the hook out of the compiler. */
async function performSetup(deps: SetupDeps): Promise<OnboardingSetupOutcome> {
  let homeId = deps.home?.id ?? null;
  if (!homeId && deps.createMissingHome) {
    const outcome = await deps.createHome(
      {
        name: deps.homeName,
        description: tGlobal('onBoarding.createdDuringOnboarding'),
        type: HomeType.Household,
        isPublic: false,
        // The server refuses a join code for an unverified email, which would
        // dead-end setup; it can be turned on later in the home's settings.
        allowJoinCode: !deps.hasUnverifiedEmail,
        tags: ['onboarding'],
      },
      deps.setupErrorMessage,
    );
    if (outcome.status === 'rejected') {
      return { status: 'failed', message: outcome.failure.body };
    }
    homeId = outcome.id;
  }

  if (homeId) {
    deps.setSelectedHomeId(homeId);
    const pantryId =
      deps.pantry?.id ?? (await createDefaultPantry(homeId, deps.createPantry));
    if (!pantryId) return { status: 'failed', message: deps.pantryFailedMessage };
    deps.setSelectedPantryId(pantryId);
  }

  if (deps.list) {
    deps.setSelectedShoppingListId(deps.list.id);
    return { status: 'done' };
  }
  const created = await deps.createShoppingList({
    name: tGlobal('onBoarding.defaultShoppingListName'),
    description: tGlobal('onBoarding.createdDuringOnboarding'),
    isDefault: true,
    tags: ['onboarding', 'groceries'],
    homeId: homeId ?? undefined,
  });
  if (created.status === 'failed') {
    return { status: 'failed', message: created.body };
  }
  deps.setSelectedShoppingListId(created.shoppingList.id);
  return { status: 'done' };
}

/**
 * The home, pantry and list onboarding needs, selected where they exist and
 * created with default names where they do not, with no form to fill.
 */
export function useOnboardingSetup() {
  const { t } = useTranslation();
  const user = useUser();
  const userId = user?.id;
  const hasUnverifiedEmail = useHasUnverifiedEmail();
  const homesQuery = useQuery(GetHomesDocument, userId ? {} : skipToken);
  const { lists, loading: listsLoading } = useShoppingListsLite({
    skip: !userId,
  });
  const { createHome } = useCreateHome(() => {
    void homesQuery.refetch();
  });
  const { createPantry } = useCreatePantry();
  const { createShoppingList } = useCreateShoppingList(
    t('errors.createShoppingListFailed'),
  );
  const setSelectedHomeId = useAppStore(state => state.setSelectedHomeId);
  const setSelectedPantryId = useSetSelectedPantryId();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  const home = extractNodes(homesQuery.data?.homes)[0];
  const pantry = defaultPantryOf(home);
  const list = lists.find(candidate => candidate.isDefault) ?? lists[0];
  const name = firstNonBlank(user?.firstName, user?.displayName, user?.name);

  return {
    /** The account's homes and lists have not been read yet. */
    loading:
      !userId ||
      (homesQuery.loading && !homesQuery.data) ||
      (listsLoading && lists.length === 0),
    hasHome: !!home,
    /** Selects what exists and creates the rest; a home only when asked to. */
    run: ({ createMissingHome }: { createMissingHome: boolean }) =>
      performSetup({
        home,
        pantry,
        list,
        createMissingHome,
        homeName: name
          ? t('onBoarding.defaultHomeName', { name })
          : t('onBoarding.defaultHomeNameNoName'),
        hasUnverifiedEmail,
        createHome,
        createPantry,
        createShoppingList,
        setSelectedHomeId,
        setSelectedPantryId,
        setSelectedShoppingListId,
        setupErrorMessage: t('onBoarding.setupError'),
        pantryFailedMessage: t('createHome.pantryFailedBody'),
      }),
  };
}
