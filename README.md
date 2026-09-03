# Liste de courses (PWA Angular)

Application PWA pour gérer des listes de courses par catégories, avec stockage **100 % local** (SQLite + OPFS) sur le smartphone.

## Concept

L'application fonctionne en **deux niveaux** :

1. **Liste de base** (modèle) — catégories et produits habituels, par type de liste (hebdomadaire, mensuelle, pharmacie).
2. **Session de courses** — créée à partir du modèle à chaque passage en magasin. Vous cochez les produits et ajustez les quantités.

## Types de liste

| Type | Particularités |
|------|----------------|
| **Courses hebdomadaire** | Catégories standard + repas + ingrédients |
| **Courses mensuelle** | Catégories standard uniquement |
| **Pharmacie** | Catégories standard uniquement |

## Statuts d'une session

| Statut | Description |
|--------|-------------|
| `preparing` | Sélection des produits, ajout de repas/ingrédients |
| `shopping` | Liste validée, prête pour le magasin (cases « pris ») |
| `completed` | Courses terminées (historique) |

## Stack

- **Angular 22** (standalone components, lazy loading)
- **SQLite WASM + OPFS** (Origin Private File System) — stockage relationnel local, persistant et offline
- **@angular/pwa** (service worker, installation offline)
- **Angular Material** (UI mobile)

## Démarrage

```bash
npm install
npm start
```

Ouvrir `http://localhost:4200`.

Le serveur de développement ajoute automatiquement les en-têtes COOP/COEP requis par SQLite WASM + OPFS.

## Scripts

```bash
npm start          # serveur de dev
npm run build      # build production (PWA)
npm run lint       # ESLint (angular-eslint)
npm run test       # tests unitaires (Vitest)
```

## Sécurité des routes

Les routes paramétrées (`/type/:listTypeId`, `/list/:id`, `/base/...`) sont protégées par des guards qui :

- rejettent les identifiants invalides (NaN, négatif, décimal) ;
- redirigent vers l'accueil si l'entité n'existe pas en base ;
- redirigent vers la liste de base si une catégorie n'appartient pas au type demandé.

## Parcours utilisateur

1. **Accueil** → choisir un type de liste (hebdo, mensuelle, pharmacie).
2. **Hub du type** → créer une nouvelle session ou reprendre une session existante.
3. **Liste de base** → configurer catégories, produits, repas et ingrédients (hebdo).
4. **Session** → cocher les produits, valider pour le magasin, marquer comme terminée.

## Build production (PWA)

```bash
npm run build
npx http-server dist/liste-de-courses/browser -p 8080
```

Pour SQLite WASM + OPFS, le serveur doit envoyer les en-têtes `Cross-Origin-Opener-Policy: same-origin` et `Cross-Origin-Embedder-Policy: require-corp`. `http-server` le fait avec `--coop` :

```bash
npx http-server dist/liste-de-courses/browser -p 8080 --coop
```

## Structure du code

```
src/app/
├── core/           # modèles, services, constantes, erreurs métier
│   ├── database/   # SQLite (schema, service, repository, mappers)
│   ├── services/   # services métier
│   └── utils/      # helpers et guards
├── features/       # pages et composants par fonctionnalité
│   ├── home/
│   ├── list-type-hub/
│   ├── shopping/
│   └── base/
│       ├── pages/      # template-list, category-detail, meals, ingredients
│       └── dialogs/    # name-dialog, meal-dialog, ingredient-dialog
└── shared/         # dialogs réutilisables (confirm)
```

Alias TypeScript : `@app/*`, `@core/*`, `@features/*` (configurés dans `tsconfig.app.json` et les schematics Angular).

## CI

Un workflow GitHub Actions (`.github/workflows/ci.yml`) exécute `lint`, `test` et `build` sur chaque push/PR vers `main` ou `master`.

## Structure des données (SQLite)

| Table | Rôle |
|-------|------|
| `baseListTypes` | Types de liste (hebdo, mensuelle, pharmacie) |
| `baseCategories` | Catégories du modèle |
| `baseProducts` | Produits du modèle |
| `baseMeals` | Repas (liste hebdo) |
| `shoppingLists` | Sessions de courses |
| `shoppingListItems` | Produits copiés avec checkbox et quantité |

## Migrations SQL

Le schéma et les futures évolutions sont gérés dans :

- `src/app/core/database/sqlite-schema.ts` — schéma initial et tables
- `src/app/core/database/migrations/` — scripts de migration versionnés

SQLite WASM gère une base `liste-de-courses.sqlite3` dans l'OPFS. Les migrations sont appliquées au démarrage de l'application.
