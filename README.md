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
npm test           # tests unitaires (Vitest)
npm run test:e2e   # tests de bout en bout (Playwright, navigateur réel)
npm run coverage   # tests unitaires + rapport de couverture
npm run lint       # ESLint
npm run format     # Prettier (écriture)
npm run build      # lint + vérif. format + tests unitaires (ce que fait la CI)
```

Pour les tests e2e, installer le navigateur une fois : `npx playwright install chromium`.

- Tests unitaires : `tests/*.test.js` ; tests e2e : `tests/e2e/*.spec.js`.
  Ils servent aussi de documentation des fonctionnalités.
- Logique pure et testable : `public/assets/core.js`.
- Test double du stockage remote (e2e) : `tests/e2e/helpers/memory-sync.js`.
- Couverture et fonctionnalités non couvertes : `UNTESTED.md`.

## Déploiement

Le workflow `.github/workflows/ci.yml` exécute les tests sur chaque _push_ et
chaque _pull request_, puis déploie le dossier `public/` sur **GitHub Pages**
lors d'un _push_ sur `main`.
