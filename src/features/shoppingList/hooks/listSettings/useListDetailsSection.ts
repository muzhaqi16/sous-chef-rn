import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { toastService } from '#/services/toastService';
import { useLazyHomeData } from '#features/home/hooks/useLazyHomeData';
import { useSetDefaultShoppingList } from '#features/shoppingList/hooks/mutations/useSetDefaultShoppingList';
import { useShoppingListTemplate } from '#features/shoppingList/hooks/mutations/useShoppingListTemplate';
import { useUpdateShoppingList } from '#features/shoppingList/hooks/mutations/useUpdateShoppingList';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { useShoppingListTemplates } from '#features/shoppingList/hooks/useShoppingListTemplates';
import type { SettingsList } from './types';

/** What the settings form saves; a new list also takes its home and template. */
export interface ListSettingsValues {
  name: string;
  isDefault: boolean;
  homeId: string | null;
  templateId: string | null;
}

interface ListDetailsOptions {
  listId: string | undefined;
  shoppingList: SettingsList;
  /** Runs the work under the screen's one saving flag, saying `failure` if it throws. */
  runSaving: (work: () => Promise<void>, failure: string) => Promise<void>;
  openList: (id: string) => void;
}

/** The list's name, default flag and home, and the templates it makes or comes from. */
export function useListDetailsSection({
  listId,
  shoppingList,
  runSaving,
  openList,
}: ListDetailsOptions) {
  const { t } = useTranslation();
  const [showHomePicker, setShowHomePicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  // Only the create screen offers "start from template"; an existing list's
  // settings shouldn't pay for the request.
  const { templates } = useShoppingListTemplates({ skip: !!listId });
  // Lazy: eager home data writes to the Zustand store and re-renders
  // ShoppingListMain.
  const {
    homes,
    state: homesState,
    fetchHomeData,
    isLoaded: homesLoaded,
  } = useLazyHomeData();
  const { updateShoppingList } = useUpdateShoppingList(
    t('errors.saveSettingsFailed'),
  );
  const { setAsDefault } = useSetDefaultShoppingList();
  const { markAsTemplate, createFromTemplate, marking, creating } =
    useShoppingListTemplate();
  const { createShoppingList } = useCreateShoppingList(
    t('errors.createListFailed'),
  );

  const save = ({ name, isDefault, homeId, templateId }: ListSettingsValues) =>
    runSaving(
      async () => {
        if (!listId && templateId) {
          // The copy is assembled on the device, so it is queued like any
          // other create and carries the home the user picked. The default
          // flag still rides on its own mutation afterwards.
          const newListId = await createFromTemplate(
            templateId,
            name,
            homeId ?? undefined,
          );
          if (!newListId) return;
          if (isDefault) await setAsDefault(newListId);
          openList(newListId);
        } else if (!listId) {
          const newList = await createShoppingList({
            name,
            description: t('shoppingListScreens.createdFromSettings'),
            isDefault,
            tags: ['user-created'],
            homeId: homeId ?? undefined,
          });
          if (newList.status === 'failed') {
            toastService.error(newList.body);
            return;
          }
          openList(newList.shoppingList.id);
        } else {
          // Local-first: a queued offline save keeps its cache write and
          // replays on reconnect. Turning the default ON goes through the
          // dedicated mutation, which unsets the prior default atomically.
          const defaultTurnedOn = isDefault && !shoppingList?.isDefault;
          const defaultTurnedOff = !isDefault && !!shoppingList?.isDefault;
          if (defaultTurnedOn) await setAsDefault(listId);
          await updateShoppingList(listId, {
            name,
            ...(defaultTurnedOff && { isDefault: false }),
          });
        }
      },
      listId ? t('errors.saveSettingsFailed') : t('errors.createListFailed'),
    );

  return {
    save,
    homes,
    homesState,
    retryHomes: fetchHomeData,
    showHomePicker,
    setShowHomePicker,
    handleOpenHomePicker: () => {
      if (!homesLoaded) fetchHomeData();
      setShowHomePicker(true);
    },
    templates,
    showTemplatePicker,
    setShowTemplatePicker,
    isTemplate: shoppingList?.isTemplate ?? false,
    templateName: shoppingList?.templateName ?? null,
    basedOnTemplate: shoppingList?.basedOnTemplate ?? null,
    marking,
    creating,
    // Templates take the name as typed, saved or not: this list kept as a
    // reusable template (with its items), or a new list made from it.
    handleSaveAsTemplate: (name: string) => {
      if (listId) {
        void markAsTemplate(
          listId,
          name.trim() || t('shoppingListScreens.thisList'),
        );
      }
    },
    handleCreateFromTemplate: (name: string) => {
      if (!listId) return;
      void runSaving(async () => {
        const newListId = await createFromTemplate(
          listId,
          name.trim() || undefined,
        );
        if (newListId) openList(newListId);
      }, t('shoppingListScreens.failedToCreateFromTemplate'));
    },
  };
}
