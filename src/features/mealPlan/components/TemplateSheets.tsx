import React, { useState } from 'react';
import { TemplateBrowserSheet } from '#features/mealPlan/components/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#features/mealPlan/components/TemplatePreviewSheet';
import { useMealTemplateActions } from '#features/mealPlan/hooks/useMealTemplateActions';
import { getMealTemplatePermissions } from '#features/mealPlan/utils/mealTemplatePermissions';
import type { MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useUser } from '#store/useAppStore';

interface TemplateSheetsProps {
  browserVisible: boolean;
  onCloseBrowser: () => void;
}

/**
 * The template browser and the preview it opens, with every template action
 * gated on the viewer's permissions. One component, so each screen state that
 * offers templates offers the same actions.
 */
export const TemplateSheets: React.FC<TemplateSheetsProps> = ({
  browserVisible,
  onCloseBrowser,
}) => {
  const { toMealTemplateBuilder } = useAppNavigation();
  const user = useUser();
  const [selectedTemplate, setSelectedTemplate] =
    useState<MealTemplateDisplayFragment | null>(null);

  const {
    createPlanFromTemplate,
    deleteTemplate,
    duplicateTemplate,
    creatingFromTemplate,
    duplicating,
  } = useMealTemplateActions();

  const permissions = selectedTemplate
    ? getMealTemplatePermissions(selectedTemplate, user?.id)
    : null;

  const closePreview = () => setSelectedTemplate(null);

  const handleSelectTemplate = (template: MealTemplateDisplayFragment) => {
    setSelectedTemplate(template);
    onCloseBrowser();
  };

  const handleCreateFromTemplate = async (config: {
    templateId: string;
    startDate: string;
    name?: string;
    servings?: number;
  }) => {
    const result = await createPlanFromTemplate(config);
    if (result) closePreview();
  };

  const handleEdit = (templateId: string) => {
    closePreview();
    toMealTemplateBuilder({ templateId });
  };

  // Closes first: the delete evicts the template the open sheet is reading.
  const handleDelete = (templateId: string) => {
    closePreview();
    void deleteTemplate(templateId);
  };

  const handleDuplicate = async (templateId: string, newName: string) => {
    const result = await duplicateTemplate(templateId, newName);
    if (result) closePreview();
  };

  return (
    <>
      <TemplateBrowserSheet
        visible={browserVisible}
        onClose={onCloseBrowser}
        onSelectTemplate={handleSelectTemplate}
      />

      <TemplatePreviewSheet
        visible={!!selectedTemplate}
        template={selectedTemplate}
        onClose={closePreview}
        onConfirm={handleCreateFromTemplate}
        confirmLoading={creatingFromTemplate}
        onEdit={permissions?.canEdit ? handleEdit : undefined}
        onDelete={permissions?.canDelete ? handleDelete : undefined}
        onDuplicate={permissions?.canDuplicate ? handleDuplicate : undefined}
        duplicating={duplicating}
      />
    </>
  );
};
