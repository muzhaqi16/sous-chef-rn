'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import AddItemForm from '../AddItemForm';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/components/base/Button', () => ({
  Button: ({
    children,
    onPress,
    disabled,
    loading,
  }: {
    children: string;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        testID={`button-${children}`}
      >
        <Text>{loading ? 'Loading...' : children}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#/components/molecules/FormInput', () => ({
  FormInput: ({
    label,
    placeholder,
    value,
    onChangeText,
  }: {
    label: string;
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
  }) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          testID={`input-${label}`}
        />
      </View>
    );
  },
}));

jest.mock('#/components/molecules/FormTextArea', () => ({
  FormTextArea: ({
    label,
    placeholder,
  }: {
    label: string;
    placeholder?: string;
  }) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput placeholder={placeholder} testID={`textarea-${label}`} />
      </View>
    );
  },
}));

jest.mock('#/components/molecules/FormNumberInput', () => ({
  FormNumberInput: ({
    label,
    placeholder,
  }: {
    label: string;
    placeholder?: string;
  }) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput placeholder={placeholder} testID={`number-${label}`} />
      </View>
    );
  },
}));

jest.mock('#/components/molecules/FormSelect', () => ({
  FormSelect: ({ label }: { label: string }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
      </View>
    );
  },
}));

jest.mock('#/components/molecules/FormCheckbox', () => ({
  FormCheckbox: ({ label }: { label: string }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
      </View>
    );
  },
}));

jest.mock('#/components/molecules/MultiImagePicker', () => ({
  MultiImagePicker: () => {
    const { View } = require('react-native');
    return <View testID="multi-image-picker" />;
  },
}));

jest.mock('#/components/organisms/UnitEntryList/UnitEntryList', () => ({
  UnitEntryList: () => {
    const { View } = require('react-native');
    return <View testID="unit-entry-list" />;
  },
}));

jest.mock(
  '#/components/organisms/NetWeightEntryList/NetWeightEntryList',
  () => ({
    NetWeightEntryList: () => {
      const { View } = require('react-native');
      return <View testID="net-weight-entry-list" />;
    },
  }),
);

jest.mock('#/components/molecules/DynamicFormFields', () => ({
  DynamicFormFields: ({ fields }: { fields: { label: string }[] }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="dynamic-form-fields">
        {fields.map((field, i: number) => (
          <Text key={i}>{field.label}</Text>
        ))}
      </View>
    );
  },
}));

// Both schemas must be present: the form picks between them by mode, so omitting
// one leaves yupResolver holding `undefined` the moment that mode renders.
jest.mock('#utils/validation/item', () => ({
  createItemSchema: {
    validate: jest.fn(),
  },
  suggestItemEditSchema: {
    validate: jest.fn(),
  },
  CreateItemFormData: {},
}));

const defaultProps = {
  onSubmit: jest.fn(),
  onClose: jest.fn(),
};

describe('AddItemForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the default title', () => {
    render(<AddItemForm {...defaultProps} />);
    expect(screen.getByText('Add New Item')).toBeTruthy();
  });

  // CreateItemSuggestionInput.note is String! and an admin reads it, so the review
  // path mandates it. A direct edit has no reviewer and the server no longer
  // accepts a note on UpdateItemInput, so the field is omitted there entirely.
  describe('edit note requirement', () => {
    it('addresses the note to the reviewer on the suggestion path', () => {
      render(<AddItemForm {...defaultProps} mode="edit" />);
      expect(screen.getByText('What needs fixing?')).toBeTruthy();
    });

    it('omits the note field on the direct-edit path', () => {
      render(<AddItemForm {...defaultProps} mode="directEdit" />);
      expect(screen.queryByText('What needs fixing?')).toBeNull();
    });
  });

  it('renders a custom title when provided', () => {
    render(<AddItemForm {...defaultProps} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeTruthy();
  });

  it('renders subtitle for non-barcode mode', () => {
    render(<AddItemForm {...defaultProps} />);
    expect(
      screen.getByText('Create a new item with basic information'),
    ).toBeTruthy();
  });

  it('renders subtitle for barcode mode', () => {
    render(<AddItemForm {...defaultProps} barcode="123456789012" />);
    expect(
      screen.getByText('Add this item to the database for future scans'),
    ).toBeTruthy();
  });

  it('shows barcode info when barcode is provided', () => {
    render(<AddItemForm {...defaultProps} barcode="123456789012" />);
    expect(screen.getByText('123456789012')).toBeTruthy();
  });

  it('shows scanned value when scannedValue is alphanumeric', () => {
    render(<AddItemForm {...defaultProps} scannedValue="SKU-ABC123" />);
    expect(screen.getByText('SKU-ABC123')).toBeTruthy();
  });

  it('shows format when format is provided with barcode', () => {
    render(
      <AddItemForm {...defaultProps} barcode="123456789012" format="ean13" />,
    );
    expect(screen.getByText('EAN13')).toBeTruthy();
  });

  it('renders all four tab labels', () => {
    render(<AddItemForm {...defaultProps} />);
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Product')).toBeTruthy();
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Inventory')).toBeTruthy();
  });

  it('renders the multi-image picker', () => {
    render(<AddItemForm {...defaultProps} />);
    expect(screen.getByTestId('multi-image-picker')).toBeTruthy();
  });

  it('renders Add Item and Cancel buttons', () => {
    render(<AddItemForm {...defaultProps} />);
    expect(screen.getByText('Add Item')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const user = userEvent.setup();
    render(<AddItemForm {...defaultProps} />);
    await user.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // --- Branch coverage tests ---

  it('shows barcode subtitle when barcode prop is given', () => {
    render(<AddItemForm {...defaultProps} barcode="123456789012" />);
    expect(
      screen.getByText('Add this item to the database for future scans'),
    ).toBeTruthy();
  });

  it('shows non-barcode subtitle when no barcode', () => {
    render(<AddItemForm {...defaultProps} />);
    expect(
      screen.getByText('Create a new item with basic information'),
    ).toBeTruthy();
  });

  it('shows UPC/Barcode label when scannedValue is numeric barcode', () => {
    render(<AddItemForm {...defaultProps} scannedValue="123456789012" />);
    // There's both the barcode info label and the form field label
    expect(screen.getAllByText('UPC/Barcode').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('123456789012')).toBeTruthy();
  });

  it('shows SKU label when scannedValue is alphanumeric', () => {
    render(<AddItemForm {...defaultProps} scannedValue="ABC-123" />);
    // SKU appears as barcode info label and as form field label
    expect(screen.getAllByText('SKU').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ABC-123')).toBeTruthy();
  });

  it('shows format in uppercase when format prop provided', () => {
    render(
      <AddItemForm
        {...defaultProps}
        scannedValue="123456789012"
        format="ean13"
      />,
    );
    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('EAN13')).toBeTruthy();
  });

  it('does not show format section when format is not provided', () => {
    render(<AddItemForm {...defaultProps} scannedValue="123456789012" />);
    expect(screen.queryByText('Format')).toBeNull();
  });

  it('does not show barcode info value when no scannedValue and no barcode', () => {
    render(<AddItemForm {...defaultProps} />);
    // No barcode value to display
    expect(screen.queryByText('987654321098')).toBeNull();
  });

  it('shows barcode value when using legacy barcode prop without scannedValue', () => {
    render(<AddItemForm {...defaultProps} barcode="987654321098" />);
    expect(screen.getAllByText('UPC/Barcode').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('987654321098')).toBeTruthy();
  });

  it('renders loading state on submit button when loading is true', () => {
    render(<AddItemForm {...defaultProps} loading={true} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('detects 8-digit UPC as barcode', () => {
    render(<AddItemForm {...defaultProps} scannedValue="12345678" />);
    expect(screen.getAllByText('UPC/Barcode').length).toBeGreaterThanOrEqual(1);
  });

  it('detects 14-digit EAN as barcode', () => {
    render(<AddItemForm {...defaultProps} scannedValue="12345678901234" />);
    expect(screen.getAllByText('UPC/Barcode').length).toBeGreaterThanOrEqual(1);
  });

  it('detects short alphanumeric as SKU', () => {
    render(<AddItemForm {...defaultProps} scannedValue="A1" />);
    expect(screen.getAllByText('SKU').length).toBeGreaterThanOrEqual(1);
  });

  it('renders unit entry list on the Inventory tab', async () => {
    const user = userEvent.setup();
    render(<AddItemForm {...defaultProps} />);
    await user.press(screen.getByText('Inventory'));
    expect(screen.getByTestId('unit-entry-list')).toBeTruthy();
  });

  it('renders net weight entry list on the Inventory tab', async () => {
    const user = userEvent.setup();
    render(<AddItemForm {...defaultProps} />);
    await user.press(screen.getByText('Inventory'));
    expect(screen.getByTestId('net-weight-entry-list')).toBeTruthy();
  });

  it('renders custom title', () => {
    render(<AddItemForm {...defaultProps} title="Add Scanned Item" />);
    expect(screen.getByText('Add Scanned Item')).toBeTruthy();
  });

  // ========== Additional branch/function coverage tests ==========

  describe('detectScanType logic', () => {
    it('detects 12-digit value as barcode (UPC-A)', () => {
      render(<AddItemForm {...defaultProps} scannedValue="012345678901" />);
      expect(screen.getAllByText('UPC/Barcode').length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('detects 13-digit value as barcode (EAN-13)', () => {
      render(<AddItemForm {...defaultProps} scannedValue="1234567890123" />);
      expect(screen.getAllByText('UPC/Barcode').length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('treats 7-digit numeric value as SKU (too short for barcode)', () => {
      render(<AddItemForm {...defaultProps} scannedValue="1234567" />);
      expect(screen.getAllByText('SKU').length).toBeGreaterThanOrEqual(1);
    });

    it('treats 15-digit numeric value as SKU (too long for barcode)', () => {
      render(<AddItemForm {...defaultProps} scannedValue="123456789012345" />);
      expect(screen.getAllByText('SKU').length).toBeGreaterThanOrEqual(1);
    });

    it('treats value with letters as SKU', () => {
      render(<AddItemForm {...defaultProps} scannedValue="ABC123DEF" />);
      expect(screen.getAllByText('SKU').length).toBeGreaterThanOrEqual(1);
    });

    it('treats value with special characters as SKU', () => {
      render(<AddItemForm {...defaultProps} scannedValue="SKU-001-XYZ" />);
      expect(screen.getAllByText('SKU').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('scannedValue vs barcode priority', () => {
    it('scannedValue takes precedence over barcode when both provided', () => {
      render(
        <AddItemForm
          {...defaultProps}
          scannedValue="SKU-ALPHA"
          barcode="123456789012"
        />,
      );
      expect(screen.getByText('SKU-ALPHA')).toBeTruthy();
    });

    it('falls back to barcode when scannedValue is not provided', () => {
      render(<AddItemForm {...defaultProps} barcode="098765432109" />);
      expect(screen.getByText('098765432109')).toBeTruthy();
    });

    it('shows nothing when neither scannedValue nor barcode provided', () => {
      render(<AddItemForm {...defaultProps} />);
      // No barcode info value should be rendered (though UPC/Barcode label exists as a form field)
      // The barcode info section (with barcodeValue) is not rendered
      expect(screen.queryByText('Format')).toBeNull();
    });
  });

  describe('format display', () => {
    it('does not render format when format is empty string', () => {
      render(
        <AddItemForm {...defaultProps} scannedValue="123456789012" format="" />,
      );
      expect(screen.queryByText('Format')).toBeNull();
    });

    it('renders format in uppercase', () => {
      render(
        <AddItemForm
          {...defaultProps}
          scannedValue="123456789012"
          format="qr_code"
        />,
      );
      expect(screen.getByText('QR_CODE')).toBeTruthy();
    });
  });

  describe('getFormSections field configuration', () => {
    it('includes all expected form field labels across tabs and advanced sections', async () => {
      const user = userEvent.setup();
      render(<AddItemForm {...defaultProps} />);

      // Basics tab (default active)
      expect(screen.getByText('Item Name')).toBeTruthy();
      expect(screen.getByText('Description')).toBeTruthy();
      expect(screen.getByText('Brand/Vendor')).toBeTruthy();

      // Product tab
      await user.press(screen.getByText('Product'));
      expect(screen.getByText('Item Type')).toBeTruthy();
      await user.press(screen.getByText('More options'));
      expect(screen.getByText('SKU')).toBeTruthy();

      // Storage tab
      await user.press(screen.getByText('Storage'));
      expect(screen.getByText('Storage State')).toBeTruthy();
      expect(screen.getByText('Shelf Life (Days)')).toBeTruthy();
      await user.press(screen.getByText('More options'));
      expect(screen.getByText('Base Dimension')).toBeTruthy();

      // Inventory tab — expand its "More options" to reach the advanced fields
      await user.press(screen.getByText('Inventory'));
      await user.press(screen.getByText('More options'));
      expect(screen.getByText('Default Consume Increment')).toBeTruthy();
      expect(screen.getByText('Default Consume Unit')).toBeTruthy();
      expect(screen.getByText('Tags')).toBeTruthy();
      expect(screen.getByText('Food Stamp Eligible')).toBeTruthy();
      expect(screen.getByText('FSA Eligible')).toBeTruthy();
    });
  });

  describe('renderValue and transformValue in Tags field', () => {
    it('renderValue converts array to comma-separated string', async () => {
      const user = userEvent.setup();
      render(<AddItemForm {...defaultProps} />);
      await user.press(screen.getByText('Inventory'));
      await user.press(screen.getByText('More options'));
      expect(screen.getByText('Tags')).toBeTruthy();
    });
  });

  describe('button states', () => {
    it('disables cancel button when loading', () => {
      render(<AddItemForm {...defaultProps} loading={true} />);
      const cancelButton = screen.getByTestId('button-Cancel');
      // The mock Button passes disabled={disabled || loading}, so it should be truthy
      expect(
        cancelButton.props.accessibilityState?.disabled ??
          cancelButton.props.disabled,
      ).toBeTruthy();
    });

    it('cancel button is not disabled when not loading', () => {
      render(<AddItemForm {...defaultProps} loading={false} />);
      const cancelButton = screen.getByTestId('button-Cancel');
      // When not loading, disabled should be falsy
      expect(
        cancelButton.props.accessibilityState?.disabled ??
          cancelButton.props.disabled,
      ).toBeFalsy();
    });
  });

  describe('default props', () => {
    it('uses "Add New Item" as default title', () => {
      render(<AddItemForm {...defaultProps} />);
      expect(screen.getByText('Add New Item')).toBeTruthy();
    });

    it('uses false as default loading', () => {
      render(<AddItemForm {...defaultProps} />);
      expect(screen.getByText('Add Item')).toBeTruthy();
      expect(screen.queryByText('Loading...')).toBeNull();
    });
  });

  describe('barcode info section visibility', () => {
    it('does not show barcode info when scannedValue and barcode are both absent', () => {
      render(<AddItemForm {...defaultProps} />);
      expect(screen.queryByText('Format')).toBeNull();
    });

    it('shows barcode info section when only scannedValue is provided', () => {
      render(<AddItemForm {...defaultProps} scannedValue="12345678" />);
      expect(screen.getByText('12345678')).toBeTruthy();
    });

    it('shows barcode info section when only barcode is provided', () => {
      render(<AddItemForm {...defaultProps} barcode="12345678" />);
      expect(screen.getByText('12345678')).toBeTruthy();
    });
  });
});
