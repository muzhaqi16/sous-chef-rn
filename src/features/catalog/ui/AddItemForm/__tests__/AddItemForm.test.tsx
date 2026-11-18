import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { t } from '#/i18n';
import { FieldRendererProvider } from '#components/molecules/fieldRenderers';
import { catalogFieldRenderers } from '#features/catalog/ui/catalogFieldRenderers';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import type {
  AddItemFieldRefusal,
  AddItemSubmitPayload,
} from '#features/catalog/types';
import AddItemForm from '../AddItemForm';

const onSubmit = jest.fn<
  Promise<AddItemFieldRefusal | void>,
  [AddItemSubmitPayload]
>();
const onClose = jest.fn();

type FormProps = Partial<React.ComponentProps<typeof AddItemForm>>;

const openForm = (props: FormProps = {}) =>
  renderWithApollo(
    <FieldRendererProvider renderers={catalogFieldRenderers}>
      <AddItemForm onSubmit={onSubmit} onClose={onClose} {...props} />
    </FieldRendererProvider>,
  );

const named = (name: string) => {
  fireEvent.changeText(
    screen.getByPlaceholderText(t('addItemForm.fields.name.placeholder')),
    name,
  );
};

/** Presses save and lets the form's validation and submit run out. */
const save = async (label = t('labels.addItem')) => {
  await userEvent.setup().press(screen.getByText(label));
  await act(async () => undefined);
};

const sent = () => {
  const [payload] = onSubmit.mock.lastCall ?? [];
  if (!payload) throw new Error('nothing was submitted');
  return payload;
};

const toPage = async (page: string) => {
  await userEvent.setup().press(screen.getByText(page));
};

const moreOptions = async () => {
  await userEvent.setup().press(screen.getByText(t('labels.moreOptions')));
};

beforeEach(() => {
  jest.clearAllMocks();
  onSubmit.mockResolvedValue(undefined);
});

describe('a scanned code', () => {
  it('is sent as the barcode when it is one', async () => {
    openForm({ scannedValue: '012345678905' });
    named('Oat milk');

    await save();

    expect(sent()).toMatchObject({ primaryUpc: '012345678905' });
    expect(sent().sku).toBeUndefined();
  });

  it('is sent as the SKU when it has letters', async () => {
    openForm({ scannedValue: 'SKU-ABC123' });
    named('Oat milk');

    await save();

    expect(sent()).toMatchObject({ sku: 'SKU-ABC123' });
    expect(sent().primaryUpc).toBeUndefined();
  });

  it('is sent as the barcode when handed in as one', async () => {
    openForm({ barcode: '123456789012' });
    named('Oat milk');

    await save();

    expect(sent()).toMatchObject({ primaryUpc: '123456789012' });
  });
});

describe('an edit', () => {
  it('keeps its name and brand, and sends no blank description', async () => {
    openForm({
      mode: 'directEdit',
      initialData: { name: 'Oat milk', brandId: 'brand-1', vendor: 'Oatly' },
    });

    await save(t('labels.saveChanges'));

    expect(sent()).toMatchObject({
      name: 'Oat milk',
      brandId: 'brand-1',
      brandName: 'Oatly',
    });
    expect(sent().description).toBeUndefined();
  });

  it('sends a brand typed but not picked by its name', async () => {
    openForm({ initialData: { name: 'Oat milk', vendor: 'Oatly' } });

    await save();

    expect(sent()).toMatchObject({ brandName: 'Oatly' });
    expect(sent().brandId).toBeUndefined();
  });

  it('asks a suggestion for its note', async () => {
    openForm({ mode: 'edit', initialData: { name: 'Oat milk' } });

    await save(t('addItemForm.modes.edit.button'));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('the form', () => {
  it('tags a food stamp item', async () => {
    openForm();
    named('Oat milk');

    await toPage(t('labels.inventory'));
    await moreOptions();
    await userEvent
      .setup()
      .press(screen.getByText(t('addItemForm.fields.foodStamp.label')));
    await save();

    expect(sent().tags).toContain('food-stamp-eligible');
  });

  it('sends the store picked', async () => {
    openForm();
    named('Oat milk');

    await toPage(t('addItemForm.tabs.product'));
    await moreOptions();
    act(() => {
      screen
        .UNSAFE_getByType(StoreAutocompleteField)
        .props.onStoreSelected('store-1', 'Corner shop');
    });
    await save();

    expect(sent()).toMatchObject({ storeId: 'store-1' });
  });

  it('shows a refusal on its field, opening its page', async () => {
    onSubmit.mockResolvedValueOnce({
      field: 'upc',
      message: 'That barcode is taken',
    });
    openForm({ scannedValue: '012345678905' });
    named('Oat milk');

    await save();

    expect(screen.getByText('That barcode is taken')).toBeTruthy();
  });

  it('opens the page of a field that fails', async () => {
    openForm({ initialData: { name: 'Oat milk', shelfLifeDays: 0 } });

    await save();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(t('addItemForm.fields.shelfLife.label'), {
        exact: false,
      }),
    ).toBeTruthy();
  });

  it('closes on cancel', async () => {
    openForm();

    // The brand picker's own Cancel renders above the form's buttons.
    const cancel = screen.getAllByText(t('labels.cancel')).at(-1);
    if (!cancel) throw new Error('no cancel');
    await userEvent.setup().press(cancel);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
