import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { TemplateCategory } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { SaveAsTemplateSheet } from '#features/mealPlan/components/SaveAsTemplateSheet';

type SheetProps = React.ComponentProps<typeof SaveAsTemplateSheet>;

const onSave = jest.fn();
const onClose = jest.fn();

const sheet = (props: Partial<SheetProps> = {}) => (
  <SaveAsTemplateSheet
    visible
    mealPlanId="mp1"
    mealPlanName="Weekly Plan"
    onClose={onClose}
    onSave={onSave}
    saving={false}
    {...props}
  />
);

const saveButton = () => screen.getByRole('button', { name: t('labels.save') });
const nameInput = () => screen.getByDisplayValue('Weekly Plan Template');

describe('SaveAsTemplateSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(sheet());
    expect(toJSON()).toBeTruthy();
  });

  it('shows Save as Template title', () => {
    render(sheet());
    expect(screen.getByText('Save as Template')).toBeTruthy();
  });

  it('renders Template Name input', () => {
    render(sheet());
    // A required field's label ends in its marker.
    expect(screen.getByText('Template Name', { exact: false })).toBeTruthy();
  });

  it('renders Description input', () => {
    render(sheet());
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('shows home name info when provided', () => {
    render(sheet({ homeName: 'Smith Home' }));
    expect(
      screen.getByText('This template will be shared with Smith Home'),
    ).toBeTruthy();
  });

  it('saves the plan as a template named after it', async () => {
    render(sheet());

    await userEvent.setup().press(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      mealPlanId: 'mp1',
      name: 'Weekly Plan Template',
      description: undefined,
      category: TemplateCategory.Weekly,
      tags: undefined,
    });
  });

  it('sends what was entered, trimmed, with the tags split', async () => {
    render(sheet());

    fireEvent.changeText(nameInput(), '  Spring Week  ');
    fireEvent.changeText(
      screen.getByPlaceholderText(t('saveAsTemplate.descriptionPlaceholder')),
      '  Light meals  ',
    );
    fireEvent.press(screen.getByText(t('labels.dinner')));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('saveAsTemplate.tagsPlaceholder')),
      ' quick, ,healthy ',
    );
    await userEvent.setup().press(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      mealPlanId: 'mp1',
      name: 'Spring Week',
      description: 'Light meals',
      category: TemplateCategory.Dinner,
      tags: ['quick', 'healthy'],
    });
  });

  it('asks for a name on the field when saved without one', async () => {
    render(sheet());

    fireEvent.changeText(nameInput(), '   ');
    await userEvent.setup().press(saveButton());

    expect(
      screen.getByText(t('mealTemplateBuilder.nameRequiredMessage')),
    ).toBeOnTheScreen();
    expect(onSave).not.toHaveBeenCalled();
    expect(saveButton()).toBeEnabled();
  });

  it('holds the save while one is in flight', () => {
    render(sheet({ saving: true }));
    expect(saveButton()).toBeDisabled();
  });

  it('opens fresh: what was typed and its error go with the closing', async () => {
    const view = render(sheet());
    fireEvent.changeText(nameInput(), '');
    await userEvent.setup().press(saveButton());
    expect(
      screen.getByText(t('mealTemplateBuilder.nameRequiredMessage')),
    ).toBeOnTheScreen();

    view.rerender(sheet({ visible: false }));
    view.rerender(sheet());

    expect(nameInput()).toBeOnTheScreen();
    expect(
      screen.queryByText(t('mealTemplateBuilder.nameRequiredMessage')),
    ).toBeNull();
  });

  it('closes without saving', async () => {
    render(sheet());

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: t('labels.close') }));

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
