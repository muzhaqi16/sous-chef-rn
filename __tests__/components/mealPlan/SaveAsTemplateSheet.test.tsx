'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { SaveAsTemplateSheet } from '../../../src/features/mealPlan/components/SaveAsTemplateSheet';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: { colors: {} },
  }),
  BottomSheetModal: ({ children }: any) => children,
}));
jest.mock('../../../src/components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: any) => children,
}));
jest.mock('../../../src/components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.title}</Text>;
  },
}));
jest.mock('../../../src/components/atoms/ChipScrollRow', () => ({
  ChipScrollRow: () => null,
}));
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../src/components/molecules/FormTextArea', () => ({
  FormTextArea: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));

describe('SaveAsTemplateSheet', () => {
  const defaultProps = {
    visible: true,
    mealPlanId: 'mp1',
    mealPlanName: 'Weekly Plan',
    onClose: jest.fn(),
    onSave: jest.fn(),
    saving: false,
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<SaveAsTemplateSheet {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Save as Template title', () => {
    const { getByText } = render(<SaveAsTemplateSheet {...defaultProps} />);
    expect(getByText('Save as Template')).toBeTruthy();
  });

  it('renders Template Name input', () => {
    const { getByText } = render(<SaveAsTemplateSheet {...defaultProps} />);
    expect(getByText('Template Name')).toBeTruthy();
  });

  it('renders Description input', () => {
    const { getByText } = render(<SaveAsTemplateSheet {...defaultProps} />);
    expect(getByText('Description')).toBeTruthy();
  });

  it('shows home name info when provided', () => {
    const { getByText } = render(
      <SaveAsTemplateSheet {...defaultProps} homeName="Smith Home" />,
    );
    expect(
      getByText('This template will be shared with Smith Home'),
    ).toBeTruthy();
  });
});
