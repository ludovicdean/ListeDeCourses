export const LIST_TYPE_WEEKLY_NAME = 'Courses hebdomadaire';
export const LIST_TYPE_MONTHLY_NAME = 'Courses mensuelle';
export const LIST_TYPE_PHARMACY_NAME = 'Pharmacie';

export interface ListTypeConfig {
  name: string;
  order: number;
  hasMealCategories: boolean;
  icon: string;
  description: string;
}

export const LIST_TYPE_CONFIGS: ListTypeConfig[] = [
  {
    name: LIST_TYPE_WEEKLY_NAME,
    order: 0,
    hasMealCategories: true,
    icon: 'shopping_cart',
    description: 'Provisions de la semaine',
  },
  {
    name: LIST_TYPE_MONTHLY_NAME,
    order: 1,
    hasMealCategories: false,
    icon: 'calendar_month',
    description: 'Achats du mois',
  },
  {
    name: LIST_TYPE_PHARMACY_NAME,
    order: 2,
    hasMealCategories: false,
    icon: 'local_pharmacy',
    description: 'Parapharmacie et soins',
  },
];

export const DEFAULT_LIST_TYPES = LIST_TYPE_CONFIGS.map(
  ({ name, order, hasMealCategories }) => ({ name, order, hasMealCategories }),
);

export interface ListTypeMeta {
  icon: string;
  description: string;
}

export function getListTypeMeta(name: string): ListTypeMeta {
  const config = LIST_TYPE_CONFIGS.find((type) => type.name === name);

  return config
    ? { icon: config.icon, description: config.description }
    : { icon: 'list', description: '' };
}
