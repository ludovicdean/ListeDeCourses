export const LIST_TYPE_WEEKLY_NAME = 'Courses hebdomadaire';
export const LIST_TYPE_MONTHLY_NAME = 'Courses mensuelle';
export const LIST_TYPE_PHARMACY_NAME = 'Pharmacie';

export const DEFAULT_LIST_TYPES = [
  { name: LIST_TYPE_WEEKLY_NAME, order: 0, hasMealCategories: true },
  { name: LIST_TYPE_MONTHLY_NAME, order: 1, hasMealCategories: false },
  { name: LIST_TYPE_PHARMACY_NAME, order: 2, hasMealCategories: false },
] as const;
