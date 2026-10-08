import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeEnrichment } from '../RecipeEnrichment';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';

const NUTRITION = {
  nutrients: [
    { name: 'Calories', amount: 420, unit: 'kcal' },
    { name: 'Protein', amount: 22, unit: 'g' },
    { name: 'Fat', amount: 15, unit: 'g' },
    { name: 'Unwanted', amount: 999, unit: 'mg' },
  ],
};

describe('RecipeEnrichment', () => {
  it('renders parsed macros from the nutrition JSON blob', () => {
    render(<RecipeEnrichment nutritionData={NUTRITION} />);
    expect(screen.getByText('Nutrition')).toBeTruthy();
    expect(screen.getByText('22 g')).toBeTruthy(); // protein
    expect(screen.getByText('15 g')).toBeTruthy(); // fat
    // Nutrients outside the macro allow-list are dropped.
    expect(screen.queryByText('999 mg')).toBeNull();
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
