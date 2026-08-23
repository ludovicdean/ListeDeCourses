import { LIST_TYPE_MONTHLY_NAME, LIST_TYPE_PHARMACY_NAME, LIST_TYPE_WEEKLY_NAME } from './list-types';

export interface ListTypeMeta {
  icon: string;
  shortLabel: string;
  description: string;
}

export const LIST_TYPE_META: Record<string, ListTypeMeta> = {
  [LIST_TYPE_WEEKLY_NAME]: {
    icon: 'shopping_cart',
    shortLabel: 'Hebdo',
    description: 'Provisions de la semaine',
  },
  [LIST_TYPE_MONTHLY_NAME]: {
    icon: 'calendar_month',
    shortLabel: 'Mensuelle',
    description: 'Achats du mois',
  },
  [LIST_TYPE_PHARMACY_NAME]: {
    icon: 'local_pharmacy',
    shortLabel: 'Pharmacie',
    description: 'Parapharmacie et soins',
  },
};

export function getListTypeMeta(name: string): ListTypeMeta {
  return (
    LIST_TYPE_META[name] ?? {
      icon: 'list',
      shortLabel: name,
      description: '',
    }
  );
}
