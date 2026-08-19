/**
 * RecipesScreen
 *
 * Screen object model for the Recipes tab.
 *
 * Deliberately minimal. This object previously exposed search, filter, sort,
 * favourite and per-card helpers built on testIDs (`recipes-search-input`,
 * `recipe-card-N`, `recipes-filter-modal`, `recipe-detail-screen`, …) that the
 * app does not render — 14 of its 15 identifiers were absent. Those methods
 * were removed rather than repointed: choosing what each one should target now
 * is authoring new coverage, not repairing existing coverage.
 *
 * Only `recipes-screen` and `tab-recipe` exist, so only navigation lives here.
 * Add a method back when the surface it drives has a testID in `src/`.
 */

import { BaseScreen } from './BaseScreen';

export class RecipesScreen extends BaseScreen {
  protected screenID = 'recipes-screen';

  /**
   * Navigate to recipes tab.
   * Tab testID is 'tab-recipe' (singular) — it derives from route name 'Recipe'.
   */
  async navigateToTab() {
    await this.tapByID('tab-recipe');
    await this.waitForScreen();
  }
}
