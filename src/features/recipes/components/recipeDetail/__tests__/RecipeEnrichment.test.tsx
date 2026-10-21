import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeEnrichment } from '../RecipeEnrichment';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import { lightTheme } from '#/theme/themes';

const NUTRITION = {
  calories: 420,
  protein: 22,
  totalCarbs: null,
  totalFat: 15,
  dietaryFiber: null,
  totalSugars: null,
  sodium: 640,
};

describe('RecipeEnrichment', () => {
  it('renders the per-serving macros the API states, each in its unit', () => {
    render(<RecipeEnrichment nutrition={NUTRITION} />);
    expect(screen.getByText('Nutrition')).toBeTruthy();
    expect(screen.getByText('420')).toBeTruthy(); // calories
    expect(screen.getByText('22 g')).toBeTruthy(); // protein
    expect(screen.getByText('15 g')).toBeTruthy(); // fat
    expect(screen.getByText('640 mg')).toBeTruthy(); // sodium
  });

  it('prefers the recipe’s own calories to the nutrition’s', () => {
    render(<RecipeEnrichment caloriesPerServing={380} nutrition={NUTRITION} />);
    expect(screen.getByText('380')).toBeTruthy();
    expect(screen.queryByText('420')).toBeNull();
  });

  it('renders tips and the forked-from provenance line', () => {
    render(
      <RecipeEnrichment
        tips="Chill the dough."
        forkedFromName="Grandma's Cookies"
      />,
    );
    expect(screen.getByText('Tips')).toBeTruthy();
    expect(screen.getByText('Chill the dough.')).toBeTruthy();
    expect(screen.getByText("Forked from Grandma's Cookies")).toBeTruthy();
  });

  it('renders nothing when a backend recipe has no enrichment', () => {
    const { toJSON } = render(
      <RecipeEnrichment status={RecipeStatus.Published} />,
    );
    // Published backend recipe with no nutrition/tips/tags → empty fragment.
    expect(toJSON()).toBeNull();
  });

  it('shows the draft badge for an unpublished backend recipe', () => {
    render(<RecipeEnrichment status={RecipeStatus.Draft} />);
    expect(screen.getByText('Draft — not published')).toBeTruthy();
  });

  // The screen's next block (About) adds no space above itself.
  it('leaves the gap below its status line', () => {
    render(
      <RecipeEnrichment
        status={RecipeStatus.Draft}
        reviewNote="Add the oven temperature."
      />,
    );

    expect(screen.root).toHaveStyle({ marginBottom: lightTheme.spacing.md });
  });

  // Submitting lands in review, never straight in PUBLISHED: a publish badge
  // there would claim a visibility the recipe does not have.
  it('says a recipe waiting for a moderator is in review', () => {
    render(<RecipeEnrichment status={RecipeStatus.PendingReview} />);
    expect(
      screen.getByText("In review — only you can see it until it's approved"),
    ).toBeTruthy();
    expect(screen.queryByText('Draft — not published')).toBeNull();
  });

  it("shows a returned draft's moderator note", () => {
    render(
      <RecipeEnrichment
        status={RecipeStatus.Draft}
        reviewNote="Add the oven temperature."
      />,
    );
    expect(
      screen.getByText("Moderator's note: Add the oven temperature."),
    ).toBeTruthy();
  });

  // A published recipe stays live while its author's edit waits for review.
  it('says an edit to a published recipe is waiting for review', () => {
    render(
      <RecipeEnrichment status={RecipeStatus.Published} hasPendingRevision />,
    );
    expect(
      screen.getByText(
        "Changes in review — everyone sees the published version until they're approved",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/In review — only you/)).toBeNull();
  });

  it("shows the moderator's note on a rejected edit to a published recipe", () => {
    render(
      <RecipeEnrichment
        status={RecipeStatus.Published}
        revisionRejectionNote="Keep the original photo."
      />,
    );
    expect(
      screen.getByText(
        "Your last changes weren't approved. Moderator's note: Keep the original photo.",
      ),
    ).toBeTruthy();
  });
});
