export const DB_FILENAME = '/liste-de-courses.sqlite3';

export const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS baseListTypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  orderIndex INTEGER NOT NULL,
  hasMealCategories INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS baseCategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listTypeId INTEGER NOT NULL,
  name TEXT NOT NULL,
  orderIndex INTEGER NOT NULL,
  type TEXT NOT NULL,
  FOREIGN KEY (listTypeId) REFERENCES baseListTypes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS baseProducts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoryId INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER,
  orderIndex INTEGER NOT NULL,
  FOREIGN KEY (categoryId) REFERENCES baseCategories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS baseMeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listTypeId INTEGER NOT NULL,
  name TEXT NOT NULL,
  recipeUrl TEXT,
  orderIndex INTEGER NOT NULL,
  FOREIGN KEY (listTypeId) REFERENCES baseListTypes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shoppingLists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listTypeId INTEGER NOT NULL,
  name TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (listTypeId) REFERENCES baseListTypes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shoppingListItems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shoppingListId INTEGER NOT NULL,
  categoryName TEXT NOT NULL,
  categoryOrder INTEGER NOT NULL,
  productName TEXT NOT NULL,
  productOrder INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  checked INTEGER NOT NULL,
  pickedUp INTEGER NOT NULL,
  itemType TEXT NOT NULL,
  recipeUrl TEXT,
  FOREIGN KEY (shoppingListId) REFERENCES shoppingLists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_list_type ON baseCategories(listTypeId, type);
CREATE INDEX IF NOT EXISTS idx_products_category ON baseProducts(categoryId);
CREATE INDEX IF NOT EXISTS idx_meals_list_type ON baseMeals(listTypeId);
CREATE INDEX IF NOT EXISTS idx_items_list ON shoppingListItems(shoppingListId);
CREATE INDEX IF NOT EXISTS idx_lists_type ON shoppingLists(listTypeId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_list_types_name ON baseListTypes(name);
`;

export const MIGRATIONS_SQL = [
  `
  -- Initial schema
  ${CREATE_SCHEMA_SQL}
  `,
];
