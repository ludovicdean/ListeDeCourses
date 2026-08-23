# Liste de courses (PWA Angular)

Application PWA pour gérer des listes de courses par catégories, avec stockage **100 % local** (IndexedDB) sur le smartphone.

## Concept

L'application fonctionne en **deux niveaux** :

1. **Liste de base** (modèle) — catégories et produits habituels. À configurer une fois (Frigo, Placard, Évier, etc.).
2. **Liste de courses** (session) — créée à partir du modèle à chaque passage en magasin. Vous cochez les produits et ajustez les quantités.

## Stack

- **Angular 22** (standalone components)
- **Dexie.js** (IndexedDB)
- **@angular/pwa** (service worker, installation offline)
- **Angular Material** (UI mobile)

## Démarrage

```bash
npm install
npm start
```

Ouvrir `http://localhost:4200`.

## Parcours utilisateur

1. **Gérer la liste de base** → ajouter catégories et produits (pré-remplie au premier lancement).
2. **Nouvelle liste de courses** → copie le modèle avec cases décochées.
3. **Faire ses courses** → cocher les produits, ajuster les quantités.
4. **Terminer** → marquer la liste comme terminée (historique conservé).

## Build production (PWA)

```bash
npm run build
npx http-server dist/liste-de-courses/browser -p 8080
```

## Structure des données (IndexedDB)

| Table | Rôle |
|-------|------|
| `baseCategories` | Catégories du modèle |
| `baseProducts` | Produits du modèle |
| `shoppingLists` | Instances de courses |
| `shoppingListItems` | Produits copiés avec checkbox et quantité |
