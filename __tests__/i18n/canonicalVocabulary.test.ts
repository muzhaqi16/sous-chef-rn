import { mergedLocale } from '#/test-utils/mergedLocales';

/**
 * Error and empty-state copy lives in one place.
 *
 * `errors.*`, `empty.*` and `labels.*` are the canonical namespaces. They
 * existed before this test and were barely used — `empty` had 8 keys with 2
 * call sites — while 33 feature namespaces had each declared their own copy for
 * the same sentences. The result was the same English rendering as different
 * Spanish or Albanian depending on which screen you were on: "Failed to add
 * item" was `Nuk u shtua dot artikulli` in the pantry and `Shtimi i artikullit
 * dështoi` from a toast.
 *
 * Consolidation alone does not hold. Nothing stopped the next feature from
 * declaring `myFeature.somethingWentWrong` — which is exactly how the 33
 * accumulated. This test makes that a build failure at the moment it is
 * written, rather than a translation-consistency bug found on a screenshot
 * months later.
 *
 * The rule: if a feature namespace declares an error/empty-state string that
 * `errors.*` / `empty.*` / `labels.*` already has, use the canonical key.
 */

const CANONICAL_NAMESPACES = ['errors', 'empty', 'labels', 'dataState'];

/**
 * Duplicates that are deliberate, each with the reason. An entry here is a
 * decision, not a snooze — and it names the exact key pair, so a NEW duplicate
 * cannot hide behind it.
 */
const COMPOSED_KEY_REASON =
  '`alertMutationFailure` composes these at runtime as ' +
  '`${keyPrefix}.${suffix}` from the mutation payload typename, so every ' +
  'prefix must carry the whole suffix set. Merging four of them onto a ' +
  'canonical key is exactly the mistake this exemption prevents — no static ' +
  'scan can see a composed key, and no lint rule caught it. The prefixes are ' +
  'checked by `composedKeyNamespaces.test.ts`.';

const INTENTIONAL: ReadonlyArray<{ keys: readonly string[]; reason: string }> = [
  {
    keys: ['recipes.difficultyLabel.MEDIUM', 'shoppingListScreens.priorityMedium'],
    reason:
      'Two adjectives that happen to coincide, not one string used twice. ' +
      'Each agrees with a different noun — recipe DIFFICULTY vs shopping-list ' +
      'PRIORITY — and they match in all four locales only because both nouns ' +
      'are feminine in es/it. The siblings already diverge (es "Fácil"/' +
      '"Difícil" vs "Baja"/"Alta"), so merging the middle term would couple ' +
      'the shopping list to the recipes namespace and break the first locale ' +
      'where the two nouns take different agreement. Per CLAUDE.md, noun ' +
      'agreement belongs in per-context keys.',
  },
  {
    keys: ['errors.entityHome', 'labels.home', 'notifications.categoryHome', 'invitationAcceptance.resourceHome', 'homeManagement.statsHome_one', 'joinHome.homeFallback'],
    reason:
      'The English is one word for two roles: sq "Shtëpia" vs ' +
      '"Shtëpi". One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['errors.entityMember', 'inviteUser.roleMemberLabel', 'homeManagement.statsMember_one', 'roles.member', 'homeRoles.member'],
    reason:
      'Same string, but the keys are reached by different mechanisms ' +
      'and cannot be re-pointed at one another.',
  },
  {
    keys: ['errors.entityInvite', 'homeManagement.cardInvite'],
    reason:
      'The English is one word for two roles: es "Invitación" vs ' +
      '"Invitar"; it "Invito" vs "Invita"; sq "Ftesë" vs "Fto". One ' +
      'form would be wrong in the other context, so the distinction ' +
      'belongs in the key rather than in a runtime parameter.',
  },
  {
    keys: ['loading.loading', 'shoppingListScreens.loading', 'pantrySettings.loading', 'listTemplate.loading'],
    reason:
      'Same string, but the keys are reached by different mechanisms ' +
      'and cannot be re-pointed at one another.',
  },
  {
    keys: ['labels.back', 'itemPhotos.perspective.back'],
    reason:
      'The English is one word for two roles: es "Atrás" vs ' +
      '"Reverso"; it "Indietro" vs "Retro"; sq "Mbrapa" vs "Prapa". ' +
      'One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['labels.pantry', 'notifications.categoryPantry', 'navigation.tabs.pantry', 'pantryScreen.tabPantry', 'homeManagement.statsPantry_one', 'pantryTabs.pantry'],
    reason:
      'The English is one word for two roles: sq "Qilari" vs "Qilar". ' +
      'One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['labels.default', 'recipes.defaultBadge', 'appearance.colorDefault', 'appearance.fontDefault', 'moveToPantry.defaultLabel', 'homeManagement.cardDefault', 'storageLocationCard.default'],
    reason:
      'The English is one word for two roles: es "Predeterminado" vs ' +
      '"Predeterminada"; it "Predefinito" vs "Predefinita"; sq "I ' +
      'parazgjedhur" vs "Parazgjedhur" vs "Të parazgjedhura". One ' +
      'form would be wrong in the other context, so the distinction ' +
      'belongs in the key rather than in a runtime parameter.',
  },
  {
    keys: ['recipes.description', 'mealPlan.description', 'saveAsTemplate.descriptionLabel', 'mealTemplateBuilder.description', 'addItemForm.fields.description.label'],
    reason:
      'The English is one word for two roles: sq "Përshkrim" vs ' +
      '"Përshkrimi". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.healthGoals', 'dietaryProfile.goalsTitle'],
    reason:
      'The English is one word for two roles: sq "Synimet ' +
      'shëndetësore" vs "Synime shëndetësore". One form would be ' +
      'wrong in the other context, so the distinction belongs in the ' +
      'key rather than in a runtime parameter.',
  },
  {
    keys: ['recipes.notes', 'pantryItemDetail.notes', 'shoppingListScreens.notes', 'manageRecipe.notes', 'recordWaste.notes', 'restockItem.notes', 'consumeItem.notes', 'addToPantry.notes', 'itemForm.notes'],
    reason:
      'The English is one word for two roles: sq "Shënime" vs ' +
      '"Shënimet". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.optional', 'ingredientMatch.optional'],
    reason:
      'The English is one word for two roles: sq "Opsionale" vs ' +
      '"Opsional". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.tags', 'recipes.recipeTags', 'pantryItemDetail.tags', 'manageRecipe.tags', 'mealTemplateBuilder.tags', 'addToPantry.tags', 'addItemForm.fields.tags.label', 'itemForm.tags'],
    reason:
      'The English is one word for two roles: sq "Etiketa" vs ' +
      '"Etiketat". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.nutritionTitle', 'pantryItemDetail.nutrition', 'itemPhotos.perspective.nutrition_label'],
    reason:
      'The English is one word for two roles: it "Valori ' +
      'nutrizionali" vs "Nutrizione"; sq "Ushqyerja" vs "Ushqyesit". ' +
      'One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.vegetarian', 'recipes.diet.VEGETARIAN', 'recipeFilters.diets.vegetarian', 'addMealSheet.dietVegetarian', 'dietaryProfile.diets.vegetarian'],
    reason:
      'The English is one word for two roles: es "Vegetariana" vs ' +
      '"Vegetariano"; it "Vegetariana" vs "Vegetariano"; sq ' +
      '"Vegjetariane" vs "Vegjetarian". One form would be wrong in ' +
      'the other context, so the distinction belongs in the key ' +
      'rather than in a runtime parameter.',
  },
  {
    keys: ['recipes.vegan', 'recipes.diet.VEGAN', 'recipeFilters.diets.vegan', 'addMealSheet.dietVegan', 'dietaryProfile.diets.vegan'],
    reason:
      'The English is one word for two roles: es "Vegana" vs ' +
      '"Vegano"; it "Vegana" vs "Vegano"; sq "Vegane" vs "Vegan". One ' +
      'form would be wrong in the other context, so the distinction ' +
      'belongs in the key rather than in a runtime parameter.',
  },
  {
    keys: ['recipes.filterAll', 'notifications.categoryAll', 'templateBrowser.categoryAll', 'pantryScreen.tabAll', 'pantryTabs.all'],
    reason:
      'The English is one word for two roles: es "Todas" vs "Todos"; ' +
      'it "Tutte" vs "Tutti". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['recipes.listItemCount_one', 'storageLocations.itemSingular', 'pantryScreen.itemCount_one', 'storageLocationCard.itemCount_one'],
    reason:
      'The English is one word for two roles: it "{{count}} elemento" ' +
      'vs "{{count}} articolo". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['recipes.listItemCount_other', 'pantrySettings.itemsCount', 'storageLocations.itemPlural', 'generateShoppingList.itemsCount', 'pantryScreen.itemCount_other', 'storageLocationCard.itemCount_other'],
    reason:
      'The English is one word for two roles: it "{{count}} elementi" ' +
      'vs "{{count}} articoli". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['recipes.diet.LACTO_VEGETARIAN', 'dietaryProfile.diets.lactoVegetarian'],
    reason:
      'The English is one word for two roles: es "Lacto-vegetariano" ' +
      'vs "Lacto-vegetariana"; it "Latto-vegetariano" vs ' +
      '"Latto-vegetariana"; sq "Lakto-vegjetarian" vs ' +
      '"Lakto-vegjetariane". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['recipes.diet.OVO_VEGETARIAN', 'dietaryProfile.diets.ovoVegetarian'],
    reason:
      'The English is one word for two roles: es "Ovo-vegetariano" vs ' +
      '"Ovo-vegetariana"; it "Ovo-vegetariano" vs "Ovo-vegetariana"; ' +
      'sq "Ovo-vegjetarian" vs "Ovo-vegjetariane". One form would be ' +
      'wrong in the other context, so the distinction belongs in the ' +
      'key rather than in a runtime parameter.',
  },
  {
    keys: ['recipes.diet.PESCETARIAN', 'recipeFilters.diets.pescetarian', 'dietaryProfile.diets.pescetarian'],
    reason:
      'The English is one word for two roles: es "Pescetariano" vs ' +
      '"Pescetariana"; it "Pescetariano" vs "Pescetariana"; sq ' +
      '"Peshkatar" vs "Pescetariane" vs "Peshkatariane". One form ' +
      'would be wrong in the other context, so the distinction ' +
      'belongs in the key rather than in a runtime parameter.',
  },
  {
    keys: ['recipes.diet.PRIMAL', 'recipeFilters.diets.primal', 'dietaryProfile.diets.primal'],
    reason:
      'The English is one word for two roles: sq "Primal" vs ' +
      '"Primale". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.intolerance.EGG', 'recipeFilters.intolerances.egg', 'dietaryProfile.intolerances.egg'],
    reason:
      'The English is one word for two roles: it "Uovo" vs "Uova". ' +
      'One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.intolerance.SULFITE', 'recipeFilters.intolerances.sulfite', 'dietaryProfile.intolerances.sulfite'],
    reason:
      'The English is one word for two roles: es "Sulfito" vs ' +
      '"Sulfitos"; it "Solfito" vs "Solfiti"; sq "Sulfit" vs ' +
      '"Sulfite". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['recipes.macroProtein', 'dietary.protein', 'nutritionSummary.macroProtein'],
    reason:
      'The English is one word for two roles: es "Proteínas" vs ' +
      '"Proteína"; sq "Proteina" vs "Proteinë". One form would be ' +
      'wrong in the other context, so the distinction belongs in the ' +
      'key rather than in a runtime parameter.',
  },
  {
    keys: ['recipes.macroFat', 'dietary.fat', 'nutritionSummary.macroFat'],
    reason:
      'The English is one word for two roles: es "Grasas" vs "Grasa"; ' +
      'sq "Yndyra" vs "Yndyrë". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['recipes.servingsCount_other', 'addMealSheet.servings', 'mealPlanItem.servings', 'templateCard.servings'],
    reason:
      'The English is one word for two roles: sq "{{count}} pjesë" vs ' +
      '"{{count}} racione". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['pantryItemDetail.fields.purchased', 'shoppingListScreens.purchased', 'addToPantry.methodPurchased', 'shoppingListScreen.tabPurchased'],
    reason:
      'The English is one word for two roles: es "Comprado" vs ' +
      '"Comprados"; it "Acquistato" vs "Acquistati"; sq "Blerë" vs ' +
      '"Të blera". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['pantryItemDetail.fields.added', 'pantryAnalytics.added', 'barcode.added'],
    reason:
      'The English is one word for two roles: sq "Shtuar" vs "Të ' +
      'shtuar" vs "U shtua". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['pantryItemDetail.batch.wasted', 'pantryAnalytics.wasted', 'usagePurpose.WASTE'],
    reason:
      'The English is one word for two roles: sq "Shpenzuar" vs "Të ' +
      'humbur" vs "Hedhur". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['pantryItemDetail.batch.expired', 'shoppingListScreens.statusExpired', 'pantryAnalytics.reasonExpired', 'filteredPantry.expired', 'recordWaste.reasonExpired', 'addToPantry.conditionExpired', 'expiration.expired'],
    reason:
      'The English is one word for two roles: es "Caducado" vs ' +
      '"Caducada"; it "Scaduto" vs "Scaduta"; sq "Skaduar" vs "I ' +
      'skaduar". One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['shoppingListScreens.membersCount', 'joinHome.memberCount_other'],
    reason:
      'Same string, but the keys are reached by different mechanisms ' +
      'and cannot be re-pointed at one another.',
  },
  {
    keys: ['shoppingListScreens.deleteListConfirmMessage', 'shoppingListSelector.deleteAlertMessage_one'],
    reason:
      'Same string, but the keys are reached by different mechanisms ' +
      'and cannot be re-pointed at one another.',
  },
  {
    keys: ['shoppingListScreens.patternDaily', 'pantryAnalytics.granularityDaily'],
    reason:
      'The English is one word for two roles: es "Diariamente" vs ' +
      '"Diario"; it "Ogni giorno" vs "Giornaliero"; sq "Çdo ditë" vs ' +
      '"Ditore". One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['shoppingListScreens.patternWeekly', 'mealPlan.weekly', 'pantryAnalytics.granularityWeekly', 'saveAsTemplate.categoryWeekly'],
    reason:
      'The English is one word for two roles: es "Semanalmente" vs ' +
      '"Semanal"; it "Ogni settimana" vs "Settimanale"; sq "Çdo javë" ' +
      'vs "Javor" vs "Javore". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['shoppingListScreens.patternMonthly', 'mealPlan.monthly', 'pantryAnalytics.granularityMonthly', 'saveAsTemplate.categoryMonthly'],
    reason:
      'The English is one word for two roles: es "Mensualmente" vs ' +
      '"Mensual"; it "Ogni mese" vs "Mensile"; sq "Çdo muaj" vs ' +
      '"Mujor" vs "Mujore". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['shoppingListScreens.patternCustom', 'storageLocationForm.typeCustom', 'saveAsTemplate.categoryCustom', 'templatePreview.customMeal'],
    reason:
      'The English is one word for two roles: es "Personalizado" vs ' +
      '"Personalizada"; it "Personalizzato" vs "Personalizzata"; sq ' +
      '"E personalizuar" vs "I personalizuar". One form would be ' +
      'wrong in the other context, so the distinction belongs in the ' +
      'key rather than in a runtime parameter.',
  },
  {
    keys: ['shoppingListScreens.listStatusActive', 'shoppingListScreens.statusActive', 'mealPlanSelector.filterActive'],
    reason:
      'The English is one word for two roles: es "Activa" vs "Activo" ' +
      'vs "Activos"; it "Attiva" vs "Attivo" vs "Attivi"; sq "Aktive" ' +
      'vs "Aktiv" vs "Aktivë". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['shoppingListScreens.listStatusTemplate', 'mealPlanSelector.createFromTemplate'],
    reason:
      'The English is one word for two roles: sq "Model" vs "Modeli". ' +
      'One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['shoppingListScreens.owner', 'inviteUser.roleOwnerLabel', 'roles.owner', 'collaboratorRoles.owner', 'homeRoles.owner'],
    reason:
      'The English is one word for two roles: sq "Pronari" vs ' +
      '"Pronar". One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['shoppingListScreens.estimatedPricePlaceholder', 'addToPantry.costPlaceholder'],
    reason:
      'The English is one word for two roles: es "p. ej., 4,99" vs ' +
      '"ej., 4,99". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['mealPlan.personal', 'mealPlanSelector.personalSubtitle'],
    reason:
      'The English is one word for two roles: sq "Personale" vs ' +
      '"Personal". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['pantryAnalytics.tabWaste', 'pantryAnalytics.purposeWaste'],
    reason:
      'The English is one word for two roles: it "Sprechi" vs ' +
      '"Spreco"; sq "Mbeturinat" vs "Mbeturinë". One form would be ' +
      'wrong in the other context, so the distinction belongs in the ' +
      'key rather than in a runtime parameter.',
  },
  {
    keys: ['pantryAnalytics.composted', 'recordWaste.composted'],
    reason:
      'The English is one word for two roles: sq "Kompostuar" vs "Të ' +
      'kompostuara". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['pantryAnalytics.consumed', 'expirationAction.consumed', 'usagePurpose.GENERAL'],
    reason:
      'The English is one word for two roles: sq "Të konsumuar" vs ' +
      '"Konsumuar". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['pantryAnalytics.purposeCooking', 'consumeItem.purposeCooking', 'usagePurpose.COOKING'],
    reason:
      'The English is one word for two roles: es "Cocina" vs ' +
      '"Cocinar" vs "Cocinado"; it "Cucina" vs "Cucinato"; sq "Gatim" ' +
      'vs "Gatuar". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['pantryAnalytics.purposeRestock', 'restockItem.restock', 'duplicateItem.restock', 'swipeActions.restock'],
    reason:
      'The English is one word for two roles: es "Reabastecimiento" ' +
      'vs "Reponer"; it "Riassortimento" vs "Rifornisci"; sq ' +
      '"Riblerje" vs "Riplotëso". One form would be wrong in the ' +
      'other context, so the distinction belongs in the key rather ' +
      'than in a runtime parameter.',
  },
  {
    keys: ['pantryAnalytics.purposeTransfer', 'consumeItem.purposeTransfer', 'homeDetail.transferOwnershipConfirm', 'usagePurpose.TRANSFER'],
    reason:
      'The English is one word for two roles: es "Transferencia" vs ' +
      '"Traslado" vs "Transferir"; it "Trasferimento" vs ' +
      '"Trasferisci"; sq "Transferim" vs "Transfero". One form would ' +
      'be wrong in the other context, so the distinction belongs in ' +
      'the key rather than in a runtime parameter.',
  },
  {
    keys: ['pantryAnalytics.reasonBurnt', 'recordWaste.reasonBurnt'],
    reason:
      'The English is one word for two roles: sq "I djegur" vs ' +
      '"Djegur". One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['pantryAnalytics.reasonSpilled', 'recordWaste.reasonSpilled'],
    reason:
      'The English is one word for two roles: sq "I derdhur" vs ' +
      '"Derdhur". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['pantryAnalytics.reasonSpoiled', 'recordWaste.reasonSpoiled', 'addToPantry.conditionSpoiled'],
    reason:
      'The English is one word for two roles: es "Estropeado" vs ' +
      '"Estropeada"; it "Andato a male" vs "Andata a male"; sq "I ' +
      'prishur" vs "Prishur". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['notifications.categoryShopping', 'shoppingListScreen.tabShopping'],
    reason:
      'The English is one word for two roles: es "Compras" vs "Por ' +
      'comprar"; it "Spesa" vs "Da comprare"; sq "Blerjet" vs "Për të ' +
      'blerë". One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['dietary.title', 'profile.sections.dietaryProfile', 'profile.labels.dietaryProfile'],
    reason:
      'The English is one word for two roles: es "Perfil alimentario" ' +
      'vs "Perfil alimenticio". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['onBoarding.createList', 'addItemSheet.createList', 'shoppingListScreen.noListsAction'],
    reason:
      'The English is one word for two roles: sq "Krijo listën" vs ' +
      '"Krijo listë" vs "Krijo Listë". One form would be wrong in the ' +
      'other context, so the distinction belongs in the key rather ' +
      'than in a runtime parameter.',
  },
  {
    keys: ['filteredPantry.expiresInDays', 'expiration.expiresInDays_other'],
    reason:
      'Same string, but the keys are reached by different mechanisms ' +
      'and cannot be re-pointed at one another.',
  },
  {
    keys: ['nutritionGoal.labelFatG', 'macroTargets.fat'],
    reason:
      'The English is one word for two roles: sq "Yndyrë (g)" vs ' +
      '"Yndyrna (g)". One form would be wrong in the other context, ' +
      'so the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['manageRecipe.tagsPlaceholder', 'saveRecipe.tagsPlaceholder'],
    reason:
      'The English is one word for two roles: es "Añadir ' +
      'etiquetas..." vs "Añade etiquetas...". One form would be wrong ' +
      'in the other context, so the distinction belongs in the key ' +
      'rather than in a runtime parameter.',
  },
  {
    keys: ['pantryScreen.tabFridge', 'pantryTabs.fridge', 'storageStateShort.REFRIGERATED'],
    reason:
      'The English is one word for two roles: it "Frigorifero" vs ' +
      '"Frigo". One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['homeManagement.modeCreate', 'onboardingSteps.CreateHome.title'],
    reason:
      'The English is one word for two roles: sq "Krijo Shtëpi" vs ' +
      '"Krijo shtëpinë". One form would be wrong in the other ' +
      'context, so the distinction belongs in the key rather than in ' +
      'a runtime parameter.',
  },
  {
    keys: ['homeManagement.statsMember_other', 'homeManagement.cardMembersSectionTitle'],
    reason:
      'The English is one word for two roles: sq "Anëtarë" vs ' +
      '"Anëtarët". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['addItemForm.fields.upc.label', 'barcode.upc'],
    reason:
      'The English is one word for two roles: sq "UPC/Barkodi" vs ' +
      '"UPC/Barkod". One form would be wrong in the other context, so ' +
      'the distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['netWeightEntry.weightLabel', 'unitType.WEIGHT'],
    reason:
      'The English is one word for two roles: sq "Pesha" vs "Peshë". ' +
      'One form would be wrong in the other context, so the ' +
      'distinction belongs in the key rather than in a runtime ' +
      'parameter.',
  },
  {
    keys: ['itemSubtitle.contentUnitCount_one', 'itemSubtitle.contentUnitCount_other'],
    reason:
      'Same string, but the keys are reached by different mechanisms ' +
      'and cannot be re-pointed at one another.',
  },
  {
    keys: [
      'suggestItemEdit.rejectedTitle',
      'suggestItemEdit.failedTitle',
      'reportItem.rejectedTitle',
      'reportItem.failedTitle',
    ],
    reason: COMPOSED_KEY_REASON,
  },
  {
    keys: [
      'itemPhotos.setPrimary.rejectedTitle',
      'itemPhotos.setPrimary.failedTitle',
    ],
    reason: COMPOSED_KEY_REASON,
  },
];

const flatten = (obj: unknown, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else if (value && typeof value === 'object')
      Object.assign(out, flatten(value, full));
  }
  return out;
};

// The merged tree — core plus every feature's copy. Reading only the core file
// would leave two thirds of the app's strings unchecked for duplication, which
// is exactly the class of problem this test exists to catch.
const en = flatten(mergedLocale('en'));

const isCanonical = (key: string) =>
  CANONICAL_NAMESPACES.includes(key.split('.')[0]);

/**
 * A string worth having one home.
 *
 * This used to be a shape test — does the copy LOOK like an error or an empty
 * state — which let every other kind of duplicate through. "Home", "Item" and
 * "Try Again" match none of those patterns, and all three had drifted into two
 * different translations by the time anyone looked. The concept a string names
 * is what makes it worth sharing, not the words it happens to contain.
 *
 * What is excluded instead is copy too short or too incidental to be one
 * concept: a bare punctuation mark, a single letter, a number.
 */
const isSharedVocabulary = (value: string) =>
  value.trim().length > 1 && /[\p{L}]/u.test(value);

/** English string -> every key that declares it. */
const keysByValue = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const [key, value] of Object.entries(en)) {
    const list = map.get(value) ?? [];
    list.push(key);
    map.set(value, list);
  }
  return map;
};

/**
 * Namespaces whose members are reached by a key built at runtime — an enum
 * value, a server error code, a validation field name, an alert prefix. A
 * member of one of these cannot be re-pointed at a canonical key, because no
 * call site names it: the key only exists once the value is substituted in.
 *
 * So when two of them hold the same string, that is not a duplicate anyone can
 * collapse — `usagePurpose.SNACK` and `mealType.SNACK` must both exist for
 * their own lookup to resolve. `enumKeyCoverage.test.ts` and
 * `composedKeyNamespaces.test.ts` are what hold those namespaces complete.
 *
 * A group with only ONE composed member is still reported: everything else in
 * it can be re-pointed at the composed key, which is what several already are.
 */
const RUNTIME_COMPOSED_NAMESPACES = [
  'auth',
  'baseDimension',
  'commonValidation',
  'cuisines',
  'errors.codes',
  'errors.field',
  'errors.resourceNames',
  'expirationAction.toast',
  'itemPhotos.perspective',
  'itemType',
  'itemValidation',
  'onboardingValidation',
  'profileValidation',
  'recipes.diet',
  'recipes.difficultyLabel',
  'recipes.healthGoal',
  'recipes.intolerance',
  'recipes.recipeStatus',
  'storageLocationForm',
  'storageState',
  'storageStateShort',
  'unitType',
  'usagePurpose',
];
const ALERT_PREFIXES = ['suggestItemEdit', 'reportItem', 'itemPhotos.setPrimary'];
const ALERT_SUFFIXES = [
  'notFoundTitle',
  'notFoundBody',
  'rejectedTitle',
  'rateLimitedTitle',
  'failedTitle',
  'failedBody',
];
const isRuntimeComposed = (key: string) =>
  RUNTIME_COMPOSED_NAMESPACES.some(ns => key.startsWith(`${ns}.`)) ||
  ALERT_PREFIXES.some(p => ALERT_SUFFIXES.some(s => key === `${p}.${s}`));

const isComposedCollision = (keys: readonly string[]) =>
  keys.filter(isRuntimeComposed).length > 1;

const isIntentional = (keys: readonly string[]) =>
  INTENTIONAL.some(
    entry =>
      entry.keys.length === keys.length &&
      keys.every(k => entry.keys.includes(k)),
  );

describe('shared copy has one canonical home', () => {
  const duplicated = [...keysByValue().entries()].filter(
    ([value, keys]) => keys.length > 1 && isSharedVocabulary(value),
  );

  it('finds duplicate groups at all, so the checks below are not vacuous', () => {
    // If the detector stops matching, every assertion here silently passes.
    // The intentional list guarantees a non-zero floor.
    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('no feature namespace redeclares copy a canonical namespace already has', () => {
    const offenders = duplicated
      .filter(([, keys]) => !isIntentional(keys))
      .filter(([, keys]) => !isComposedCollision(keys))
      .filter(([, keys]) => keys.some(isCanonical))
      .map(
        ([value, keys]) =>
          `${JSON.stringify(value)}\n    canonical: ${keys.filter(isCanonical).join(', ')}` +
          `\n    redeclared as: ${keys.filter(k => !isCanonical(k)).join(', ')}`,
      );

    expect(offenders).toEqual([]);
  });

  it('no two feature namespaces declare the same copy', () => {
    // No canonical key involved — these are features duplicating each other,
    // which is how the canonical namespaces came to be unused in the first
    // place. Add the string to `errors.*` / `empty.*` / `labels.*` and point
    // both at it.
    const offenders = duplicated
      .filter(([, keys]) => !isIntentional(keys))
      .filter(([, keys]) => !isComposedCollision(keys))
      .filter(([, keys]) => !keys.some(isCanonical))
      .map(([value, keys]) => `${JSON.stringify(value)} — ${keys.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  // Neither assertion above sees this group: one filters to "some key is
  // canonical" and the other to "no key is canonical", so a string declared
  // twice INSIDE the canonical namespaces falls between them — and that is the
  // one place a duplicate is hardest to spot, because both homes look right.
  it('no canonical namespace redeclares copy another canonical one has', () => {
    const offenders = duplicated
      .filter(([, keys]) => !isIntentional(keys))
      .filter(([, keys]) => !isComposedCollision(keys))
      .filter(([, keys]) => keys.every(isCanonical))
      .map(([value, keys]) => `${JSON.stringify(value)} — ${keys.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  it('every intentional exemption still describes a real duplicate', () => {
    // An exemption whose keys no longer collide has outlived its subject and
    // would go on excusing a future duplicate that happened to match.
    const stale = INTENTIONAL.filter(entry => {
      const values = entry.keys.map(k => en[k]);
      return (
        values.some(v => v === undefined) || new Set(values).size !== 1
      );
    }).map(entry => entry.keys.join(', '));

    expect(stale).toEqual([]);
  });
});
