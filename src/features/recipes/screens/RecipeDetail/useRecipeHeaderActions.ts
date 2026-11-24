import { useTranslation, type TranslationKey } from '#/i18n';
import {
  ModerationContentType,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import type { IconName } from '#components/atoms/Icon';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { useForkRecipe } from '#features/recipes/hooks/useForkRecipe';
import { usePublishRecipe } from '#features/recipes/hooks/usePublishRecipe';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useUser } from '#store/useAppStore';
import type { RecipeDetailState } from './useRecipeDetail';
import type { RecipeSheet } from '#features/recipes/components/recipeDetail/RecipeDetailSheets';

/** Submit a draft, withdraw one in review, unpublish a published one. */
const PUBLISH_ACTION_ICON: Readonly<Record<RecipeStatus, IconName>> = {
  [RecipeStatus.Draft]: 'cloud-upload-outline',
  [RecipeStatus.PendingReview]: 'hourglass-outline',
  [RecipeStatus.Published]: 'cloud-done-outline',
};
const PUBLISH_ACTION_LABEL: Readonly<Record<RecipeStatus, TranslationKey>> = {
  [RecipeStatus.Draft]: 'recipes.publishA11y',
  [RecipeStatus.PendingReview]: 'recipes.withdrawA11y',
  [RecipeStatus.Published]: 'recipes.unpublishA11y',
};

/**
 * The recipe bar's actions. Favourite and meal plan lead: they stay in the bar
 * when the rest go behind its "more".
 */
export function useRecipeHeaderActions(
  detail: RecipeDetailState,
  openSheet: (sheet: RecipeSheet) => void,
  openMealPlan: () => void,
): HeaderAction[] {
  const { t } = useTranslation();
  const { toRecipeEdit, toRecipeDetail } = useAppNavigation();
  const user = useUser();
  const { forkRecipe, forking } = useForkRecipe();
  const { setSubmitted, publishing } = usePublishRecipe();
  const {
    recipeId,
    backendRecipe,
    displayData,
    isSaved,
    savedFolder,
    saving,
    updatingFolderTags,
    handleSaveRecipe,
  } = detail;
  const busy = saving || updatingFolderTags;

  const isInFavorites = isSaved && savedFolder === 'Favorites';
  const isInOtherFolder =
    isSaved && !!savedFolder && savedFolder !== 'Favorites';
  const showHeartIcon = !isSaved || isInFavorites || !savedFolder;
  const showFolderIcon = !isSaved || isInOtherFolder || !savedFolder;

  // A catalog recipe has no author, so nobody owns it and it offers a fork,
  // once fetched: a fork of a stub copies only its name and image.
  const isOwner = !!user && backendRecipe?.createdBy?.id === user.id;
  const canFork =
    !!backendRecipe && !isOwner && displayData?.details === 'complete';
  // Another user's recipe only: a catalog recipe has no author to report.
  const author = backendRecipe?.createdBy;
  const reportTarget =
    user && backendRecipe && author && author.id !== user.id
      ? {
          reportedUserId: author.id,
          contentType: ModerationContentType.Recipe,
          contentId: backendRecipe.id,
        }
      : null;
  const status = displayData?.status ?? RecipeStatus.Draft;

  // Saved in Favorites: manage it. Otherwise one press saves it there.
  const handleHeartPress = () => {
    if (busy) return;
    if (isInFavorites) openSheet({ type: 'manage' });
    else handleSaveRecipe('Favorites');
  };

  // Saved: manage it. Otherwise save it with a folder, tags and notes.
  const handleFolderPress = () => {
    if (busy) return;
    openSheet({ type: isSaved ? 'manage' : 'save' });
  };

  // Fork a recipe into an editable copy, then open the new copy.
  const handleForkRecipe = async () => {
    if (!recipeId) return;
    const newId = await forkRecipe(recipeId);
    if (newId) toRecipeDetail({ recipeId: newId });
  };

  return [
    ...(showHeartIcon
      ? [
          {
            icon: isInFavorites ? 'heart' : 'heart-outline',
            accessibilityLabel: isInFavorites
              ? t('recipes.unfavoriteA11y')
              : t('recipes.favoriteA11y'),
            onPress: handleHeartPress,
            tone: 'favorite',
            loading: busy,
            testID: recipesTestIDs.heartButton,
          } satisfies HeaderAction,
        ]
      : []),
    ...(recipeId
      ? [
          {
            icon: 'calendar-outline',
            onPress: openMealPlan,
            variant: 'primary',
            accessibilityLabel: t('recipes.addToMealPlanA11y'),
            testID: recipesTestIDs.mealPlanButton,
          } satisfies HeaderAction,
        ]
      : []),
    ...(isOwner && recipeId
      ? [
          {
            icon: 'create-outline',
            accessibilityLabel: t('labels.edit'),
            onPress: () => toRecipeEdit({ recipeId }),
            variant: 'primary',
            testID: recipesTestIDs.editButton,
          } satisfies HeaderAction,
          {
            // A draft is submitted for review; one in review or published
            // goes back to a draft.
            icon: PUBLISH_ACTION_ICON[status],
            onPress: () => {
              void setSubmitted(recipeId, status === RecipeStatus.Draft);
            },
            variant: 'primary',
            loading: publishing,
            accessibilityLabel: t(PUBLISH_ACTION_LABEL[status]),
            testID: recipesTestIDs.publishButton,
          } satisfies HeaderAction,
        ]
      : []),
    ...(canFork
      ? [
          {
            icon: 'git-branch-outline',
            onPress: () => {
              void handleForkRecipe();
            },
            variant: 'primary',
            loading: forking,
            accessibilityLabel: t('recipes.forkA11y'),
            testID: recipesTestIDs.forkButton,
          } satisfies HeaderAction,
        ]
      : []),
    ...(showFolderIcon
      ? [
          {
            icon: isInOtherFolder ? 'folder' : 'folder-outline',
            accessibilityLabel: t('folderPicker.selectFolder'),
            onPress: handleFolderPress,
            variant: 'primary',
            disabled: busy,
            testID: recipesTestIDs.folderButton,
          } satisfies HeaderAction,
        ]
      : []),
    ...(reportTarget
      ? [
          {
            icon: 'flag-outline',
            accessibilityLabel: t('reports.reportRecipe'),
            onPress: () => openSheet({ type: 'report', target: reportTarget }),
            variant: 'secondary',
            testID: recipesTestIDs.reportButton,
          } satisfies HeaderAction,
        ]
      : []),
  ];
}
