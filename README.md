# favoris

Pages de favoris multi-espaces, _offline-first_, avec synchronisation optionnelle
**par espace** (voir `DOCS-SYNC.md`).

L'application est 100 % statique : le dossier `public/` ne contient que du HTML,
du CSS et des modules JavaScript natifs — **aucun framework en production**.

## Développement

Les outils de dev (test + qualité) sont en `devDependencies` uniquement et ne
sont jamais déployés.

```bash
npm install        # installe les outils de dev
npm test           # lance les tests (Vitest)
npm run coverage   # tests + rapport de couverture
npm run lint       # ESLint
npm run format     # Prettier (écriture)
npm run build      # lint + vérif. format + tests (ce que fait la CI)
```

- Tests : `tests/` (servent aussi de documentation des fonctionnalités).
- Logique pure et testable : `public/assets/core.js`.
- Fonctionnalités non couvertes par les tests : `UNTESTED.md`.

## Déploiement

Le workflow `.github/workflows/ci.yml` exécute les tests sur chaque _push_ et
chaque _pull request_, puis déploie le dossier `public/` sur **GitHub Pages**
lors d'un _push_ sur `main`.
